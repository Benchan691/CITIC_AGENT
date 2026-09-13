import { dirname } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { canOpenNativePath, openNativePath, openNativeTextFile } from "@deepseek-ai/dsh-native-command";
import { Remote, RemoteError, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { z } from "zod";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
//#region src/credentials.ts
/**
* Fan-out bound on one remote `describe` batch. A settings page asks about the
* references its own rows name, so this is far above any real page and still
* keeps one authenticated request from starting unbounded provider work.
*/
const MAX_DESCRIBE_REFS = 64;
const credentialRefSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/);
const describeRequestSchema = z.object({ refs: z.array(credentialRefSchema).max(MAX_DESCRIBE_REFS) });
const setRequestSchema = z.object({
	ref: credentialRefSchema,
	value: z.string().min(1)
});
const unsetRequestSchema = z.object({ ref: credentialRefSchema });
/** Parse the domain constraints that are more specific than generated TypeScript codecs. */
function parseRequest(method, schema, value) {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new RemoteError("gateway/bad-request", `invalid payload for ${method}`, { issues: parsed.error.issues });
	return parsed.data;
}
/**
* Copy exactly the fields {@link CredentialInfo} declares. The Gateway returns
* a business result without decoding it, so a provider whose `describe` carried
* extra enumerable properties would otherwise serialize them to the caller.
* @param info - the provider's answer for one reference.
* @returns the same facts with nothing else attached.
*/
function projectCredentialInfo(info) {
	return {
		configured: info.configured,
		...info.source === void 0 ? {} : { source: info.source },
		writable: info.writable
	};
}
/**
* Host service backing the generated `ctx.remote.credentials` namespace. It
* carries every wire obligation the credential seam itself does not: the batch
* fan-out bound, the field-by-field view projection, the reference-grammar
* guard, and the refusal mapping. Secret values cross in one direction only —
* no method here returns one.
*/
var CredentialsController = class extends TypertRemoteService {
	static inject = ["socAuth"];
	auth;
	/** @param ctx - Host context where a credential provider may be mounted. */
	constructor(ctx) {
		super(ctx, "credentialsController", { namespace: "credentials" });
		this.auth = ctx.get("socAuth");
	}
	/**
	* Describe several references for one configuration surface. Batched because
	* a settings page describes every reference its rows name at once, and one
	* round trip keeps those rows from settling separately.
	* @param refs - reference names, at most {@link MAX_DESCRIBE_REFS}; a name outside the grammar
	*   rejects the whole call as `gateway/bad-request`.
	* @returns one view per requested name, keyed by that name.
	* @throws RemoteError when the request is invalid or no credential provider is mounted.
	*/
	@Remote async describe(refs) {
		this.requireAdministrator();
		const branded = parseRequest("credentials.describe", describeRequestSchema, { refs }).refs.map((ref) => [ref, credentialRef(ref)]);
		const credentials = this.provider();
		const entries = await Promise.all(branded.map(async ([ref, key]) => [ref, projectCredentialInfo(await credentials.describe(key))]));
		return Object.fromEntries(entries);
	}
	/**
	* Store one value from a configuration surface. The value crosses the wire in
	* this direction only: no read path returns it.
	* @param ref - reference name to store under.
	* @param value - the non-empty secret value.
	* @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
	*/
	@Remote async set(ref, value) {
		this.requireAdministrator();
		const request = parseRequest("credentials.set", setRequestSchema, {
			ref,
			value
		});
		const branded = credentialRef(request.ref);
		const credentials = this.provider();
		await this.write(request.ref, () => credentials.set(branded, request.value));
	}
	/**
	* Remove one reference from a configuration surface.
	* @param ref - reference name to remove.
	* @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
	*/
	@Remote async unset(ref) {
		this.requireAdministrator();
		const request = parseRequest("credentials.unset", unsetRequestSchema, { ref });
		const branded = credentialRef(request.ref);
		const credentials = this.provider();
		await this.write(request.ref, () => credentials.unset(branded));
	}
	/** Resolve the optional provider or report how to supply it. */
	provider() {
		const credentials = this.ctx.get("credentials");
		if (credentials === void 0) throw new RemoteError("gateway/internal", "credentials service is absent: this deployment does not mount a credential provider (e.g. @deepseek-ai/dsh-credentials-local) in its composition", {});
		return credentials;
	}
	/**
	* Run one remote write and report every refusal as `credential/rejected`
	* carrying the seam's own message: a read-only source shadowing the reference
	* is what a configuration surface must show verbatim. Callers brand the
	* reference before entering, so a name outside the grammar never reaches this
	* path and fails the same way it does on the read side. The details name only
	* the reference, so no failure path can carry the value back out.
	*/
	async write(ref, write) {
		try {
			await write();
		} catch (error) {
			throw new RemoteError("credential/rejected", error instanceof Error ? error.message : String(error), { ref }, { cause: error });
		}
	}
	requireAdministrator() {
		try {
			this.auth.requireAdmin();
		} catch (error) {
			throw new RemoteError("credential/rejected", "administrator access is required", { ref: "[redacted]" }, { cause: error });
		}
	}
};
//#endregion
//#region src/index.ts
/**
* Host Remote owner for the configuration surfaces over the settings-domain
* seams. Two namespaces: `settings`, the redacted reads and writes of
* `ctx.settings`, owned by the class below; and `credentials`, mounted from
* here as its own plugin.
*
* @module dsh-soc-agent-api-settings-controller
*/
const settingsNamespaceRequestSchema = z.object({ ns: z.string().min(1) });
const DEFAULT_USER_NAMESPACES = [
	"dsh-auto-collapse",
	"soc-action-approval",
	"soc-agent-markitdown-attachments",
	"ui-chat",
	"ui-conversation",
	"ui-layout",
	"ui-sidebar",
	"ui-theme",
	"ui-workspace"
];
/** Read abort state afresh after an awaited provider or opener call. */
function isAborted(signal) {
	return signal.aborted;
}
/**
* Project one redacted descriptor onto its wire view, field by field. The
* Gateway returns a business result without decoding it, so a provider whose
* descriptor carried extra enumerable properties would otherwise serialize them
* to the caller.
* @param descriptor - one descriptor read under `redactSecrets`.
* @returns the same facts with nothing else attached.
*/
function namespaceView(descriptor) {
	return {
		ns: String(descriptor.ns),
		schema: descriptor.schema,
		value: descriptor.value,
		...descriptor.base === void 0 ? {} : { base: descriptor.base },
		...descriptor.user === void 0 ? {} : { user: descriptor.user },
		applies: descriptor.applies,
		secrets: (descriptor.secrets ?? []).map((secret) => ({
			path: [...secret.path],
			set: secret.set
		})),
		revision: descriptor.revision
	};
}
/**
* Host service backing the generated `ctx.remote.settings` namespace. Every
* remote read uses `redactSecrets: true`, so a `role('secret')` field cannot
* ride a response. Writes expose the settings service's merge, replacement,
* and path-addressed operations, and classify every provider refusal as
* `settings/conflict` or `settings/rejected` with the service's message.
*/
var SettingsController = class extends TypertRemoteService {
	static inject = ["socAuth"];
	static Config = Schema.object({
		nativeOpen: Schema.boolean(),
		userNamespaces: Schema.array(Schema.string()).default([...DEFAULT_USER_NAMESPACES])
	});
	openPath;
	openTextFile;
	canOpenPath;
	auth;
	userNamespaces;
	/**
	* Register the settings namespace and mount the credentials namespace beside
	* it. Both namespaces stay registered when a provider is absent so calls can
	* return the configuration API's actionable missing-provider diagnostic.
	* @param ctx - Host context where settings and credential providers may be mounted.
	*/
	constructor(ctx, config = {}, internals = {}) {
		super(ctx, "settingsController", { namespace: "settings" });
		this.openPath = internals.openPath ?? openNativePath;
		this.openTextFile = internals.openTextFile ?? openNativeTextFile;
		this.canOpenPath = internals.canOpenPath ?? (() => config.nativeOpen ?? (internals.openPath !== void 0 || canOpenNativePath()));
		this.auth = ctx.get("socAuth");
		this.userNamespaces = new Set(config.userNamespaces ?? DEFAULT_USER_NAMESPACES);
		ctx.plugin(CredentialsController);
	}
	/**
	* Describe every registered namespace for a configuration page: redacted
	* layered values plus the serialized schema the page renders its form from.
	* @returns provider writability, local-document presence, and one view per namespace.
	* @throws RemoteError when no settings provider is mounted.
	*/
	@Remote describe() {
		const settings = this.provider();
		const administrator = this.isAdministrator();
		return {
			writable: settings.writable,
			hasDocument: administrator && settings.documentPath !== void 0,
			namespaces: settings.describe({ redactSecrets: true }).filter((descriptor) => administrator || this.userNamespaces.has(String(descriptor.ns))).map(namespaceView)
		};
	}
	/**
	* Report whether this deployment can open an authored Agent preset directory natively.
	* @returns true when the matching open operation is available.
	*/
	@Remote canOpenAgentPresetDirectory() {
		return this.isAdministrator() && this.canOpenPath();
	}
	/**
	* Merge a patch into one namespace's stored user section.
	* @param ns - namespace key to write.
	* @param patch - fields to merge into the user section.
	* @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
	* @returns the namespace's redacted view after the write.
	* @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
	*/
	@Remote update(ns, patch, expectedRevision) {
		return this.write(ns, "update", patch, expectedRevision);
	}
	/**
	* Replace one namespace's stored user section wholesale.
	* @param ns - namespace key to write.
	* @param section - complete replacement user section.
	* @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
	* @returns the namespace's redacted view after the write.
	* @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
	*/
	@Remote replace(ns, section, expectedRevision) {
		return this.write(ns, "replace", section, expectedRevision);
	}
	/**
	* Apply path-addressed edits to one namespace's user section, resolved against
	* the section as stored rather than against whatever the caller last read,
	* then answer with that namespace's new redacted view.
	* @param ns - namespace key to write.
	* @param ops - the edits to apply, in order.
	* @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
	* @returns the namespace's redacted view after the write.
	* @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
	*/
	@Remote async mutate(ns, ops, expectedRevision) {
		return this.write(ns, "mutate", ops, expectedRevision);
	}
	/**
	* Materialize the provider-owned settings document and open it in a native text editor.
	* @param signal - caller lifetime; abort terminates preparation or the native command.
	* @returns confirmation after the native opener accepts the document.
	* @throws RemoteError when no document exists, preparation fails, or opening fails.
	*/
	@Remote async openSettingsDocument(signal) {
		this.requireAdministrator();
		const settings = this.provider();
		if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
		let path;
		try {
			path = await settings.prepareDocument();
		} catch (error) {
			if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document preparation was aborted", {});
			throw new RemoteError("gateway/internal", `settings document preparation failed: ${messageOf(error)}`, {}, { cause: error });
		}
		if (path === void 0) throw new RemoteError("gateway/internal", "settings provider has no local document to open", {});
		if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
		try {
			await this.openTextFile(path, signal);
			return { opened: true };
		} catch (error) {
			if (isAborted(signal)) throw new RemoteError("gateway/cancelled", "settings document open was aborted", {});
			throw new RemoteError("gateway/internal", `path open failed: ${messageOf(error)}`, {}, { cause: error });
		}
	}
	/**
	* Open one user-authored Agent preset directory or return its path when no native opener exists.
	* @param agentPreset - preset id resolved against Host-owned roots.
	* @param signal - caller lifetime; abort terminates the native command.
	* @returns an opened confirmation or the resolved directory for text display.
	* @throws RemoteError when the preset is missing, read-only, invalid, or cannot be opened.
	*/
	@Remote async openAgentPresetDirectory(agentPreset, signal) {
		this.requireAdministrator();
		if (agentPreset.length === 0) throw new RemoteError("gateway/bad-request", "agent preset id must not be empty", {});
		const presets = this.ctx.get("agentPresets");
		if (presets === void 0) throw new RemoteError("agent-preset/not-found", "this deployment composes no agent presets", {
			agentPreset,
			available: []
		});
		const preset = await presets.resolve(agentPreset);
		if (preset.trust !== "user") throw new RemoteError("agent-preset/read-only", `agent-presets: preset "${preset.id}" cannot be written: it ships with the deployment`, {
			agentPreset: preset.id,
			reason: "it ships with the deployment"
		});
		const directory = dirname(preset.path);
		if (!this.canOpenPath()) return {
			opened: false,
			path: directory
		};
		try {
			await this.openPath(directory, signal);
			return { opened: true };
		} catch (error) {
			if (signal.aborted) throw new RemoteError("gateway/cancelled", "path open was aborted", {});
			throw new RemoteError("gateway/internal", `path open failed: ${messageOf(error)}`, {}, { cause: error });
		}
	}
	async write(ns, mode, input, expectedRevision) {
		const parsed = settingsNamespaceRequestSchema.safeParse({ ns });
		if (!parsed.success) throw new RemoteError("gateway/bad-request", `invalid payload for settings.${mode}`, { issues: parsed.error.issues });
		const settings = this.provider();
		const namespace = parsed.data.ns;
		this.requireNamespace(namespace);
		try {
			if (mode === "update") await settings.update(namespace, input, expectedRevision);
			else if (mode === "replace") await settings.replace(namespace, input, expectedRevision);
			else await settings.mutate(namespace, input, expectedRevision);
		} catch (error) {
			throw rejected(ns, error);
		}
		const descriptor = settings.describe({ redactSecrets: true }).find((candidate) => candidate.ns === namespace);
		if (descriptor === void 0) throw new RemoteError("gateway/internal", `settings namespace "${ns}" was disposed after the ${mode}`, {});
		return namespaceView(descriptor);
	}
	/** Resolve the optional provider or report how to supply it. */
	provider() {
		const settings = this.ctx.get("settings");
		if (settings === void 0) throw new RemoteError("gateway/internal", "settings service is absent: this deployment does not mount a settings provider (e.g. dsh-soc-agent-settings-file) in its composition", {});
		return settings;
	}
	isAdministrator() {
		try {
			this.auth.requireAdmin();
			return true;
		} catch {
			this.auth.requireUser();
			return false;
		}
	}
	requireAdministrator() {
		try {
			this.auth.requireAdmin();
		} catch (error) {
			throw new RemoteError("settings/rejected", "administrator access is required", { ns: "deployment" }, { cause: error });
		}
	}
	requireNamespace(ns) {
		if (this.isAdministrator() || this.userNamespaces.has(ns)) return;
		throw new RemoteError("settings/rejected", `settings namespace "${ns}" is not available to users`, { ns });
	}
};
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
function settingsConflictOf(error) {
	if (typeof error !== "object" || error === null) return void 0;
	if (Reflect.get(error, "code") !== "SETTINGS_CONFLICT" || typeof Reflect.get(error, "message") !== "string" || typeof Reflect.get(error, "expected") !== "number" || typeof Reflect.get(error, "actual") !== "number") return void 0;
	return error;
}
/**
* Classify one seam refusal. A stale writer is its own outcome, not a malformed
* request: the client must re-read and re-apply rather than treat the write as
* invalid.
* @param ns - the namespace the write addressed.
* @param error - whatever the seam threw.
* @returns the failure to raise for that refusal.
*/
function rejected(ns, error) {
	const conflict = settingsConflictOf(error);
	if (conflict !== void 0) return new RemoteError("settings/conflict", conflict.message, {
		ns,
		expected: conflict.expected,
		actual: conflict.actual
	}, { cause: error });
	return new RemoteError("settings/rejected", messageOf(error), { ns }, { cause: error });
}
//#endregion
export { CredentialsController, SettingsController, SettingsController as default };
