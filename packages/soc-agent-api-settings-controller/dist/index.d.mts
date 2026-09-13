import Schema from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { Context } from "@deepseek-ai/cordis";
import { SettingsDescribeValue, SettingsNamespaceView, SettingsPathOpView } from "@deepseek-ai/dsh-settings/types";
import { CredentialInfo } from "@deepseek-ai/dsh-credentials/types";
//#region ../../node_modules/.pnpm/@deepseek-ai+dsh-util-values@0.1.5-rc.2_@deepseek-ai+cordis@4.0.2/node_modules/@deepseek-ai/dsh-util-values/lib/types/index.d.ts
/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
/** A value that round-trips through JSON without loss. */
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
//#endregion
//#region src/types.d.ts
/**
 * Browser-safe failure vocabulary of the configuration surfaces this package
 * serves. The redacted views themselves live with their seam in
 * `@deepseek-ai/dsh-settings/types`, whose Cordis event declarations already
 * register that file for the Client compilation face.
 *
 * @module dsh-soc-agent-api-settings-controller/types
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /**
     * Every seam refusal that is not a stale write: an unregistered or malformed
     * namespace, a read-only provider, schema validation, storage.
     */
    'settings/rejected': {
      readonly ns: string;
    };
    /**
     * The stored revision moved after the caller read it. Its own outcome rather
     * than an invalid request: the caller must re-read and re-apply.
     */
    'settings/conflict': {
      readonly ns: string;
      readonly expected: number;
      readonly actual: number;
    };
    /**
     * The provider refused a valid credential write, for example because a
     * read-only source shadows the reference. The details name only the
     * reference, never the value.
     */
    'credential/rejected': {
      readonly ref: string;
    };
  }
}
/** Confirmation that the settings document was handed to the native editor. */
interface SettingsDocumentOpenValue {
  readonly opened: true;
}
/** Result of opening or revealing one locally authored Agent preset directory. */
type AgentPresetDirectoryOpenValue = {
  readonly opened: true;
} | {
  readonly opened: false;
  readonly path: string;
};
//#endregion
//#region src/credentials.d.ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `credentials` Remote namespace. */
    credentialsController: CredentialsController;
  }
}
/**
 * Host service backing the generated `ctx.remote.credentials` namespace. It
 * carries every wire obligation the credential seam itself does not: the batch
 * fan-out bound, the field-by-field view projection, the reference-grammar
 * guard, and the refusal mapping. Secret values cross in one direction only —
 * no method here returns one.
 */
declare class CredentialsController extends TypertRemoteService {
  static inject: string[];
  private readonly auth;
  /** @param ctx - Host context where a credential provider may be mounted. */
  constructor(ctx: Context);
  /**
   * Describe several references for one configuration surface. Batched because
   * a settings page describes every reference its rows name at once, and one
   * round trip keeps those rows from settling separately.
   * @param refs - reference names, at most {@link MAX_DESCRIBE_REFS}; a name outside the grammar
   *   rejects the whole call as `gateway/bad-request`.
   * @returns one view per requested name, keyed by that name.
   * @throws RemoteError when the request is invalid or no credential provider is mounted.
   */
  describe(refs: string[]): Promise<Record<string, CredentialInfo>>;
  /**
   * Store one value from a configuration surface. The value crosses the wire in
   * this direction only: no read path returns it.
   * @param ref - reference name to store under.
   * @param value - the non-empty secret value.
   * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
   */
  set(ref: string, value: string): Promise<void>;
  /**
   * Remove one reference from a configuration surface.
   * @param ref - reference name to remove.
   * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
   */
  unset(ref: string): Promise<void>;
  /** Resolve the optional provider or report how to supply it. */
  private provider;
  /**
   * Run one remote write and report every refusal as `credential/rejected`
   * carrying the seam's own message: a read-only source shadowing the reference
   * is what a configuration surface must show verbatim. Callers brand the
   * reference before entering, so a name outside the grammar never reaches this
   * path and fails the same way it does on the read side. The details name only
   * the reference, so no failure path can carry the value back out.
   */
  private write;
  private requireAdministrator;
}
//#endregion
//#region src/index.d.ts
/** Native document-opening policy. */
interface Config {
  /** Override platform desktop-opener detection. */
  readonly nativeOpen?: boolean;
  /** Settings namespaces ordinary authenticated users may read and update. */
  readonly userNamespaces?: string[];
}
/** Host integrations replaceable by direct unit tests. */
interface SettingsControllerInternals {
  readonly openPath?: (path: string, signal: AbortSignal) => Promise<void>;
  readonly openTextFile?: (path: string, signal: AbortSignal) => Promise<void>;
  readonly canOpenPath?: () => boolean;
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `settings` Remote namespace. */
    settingsController: SettingsController;
  }
}
/**
 * Host service backing the generated `ctx.remote.settings` namespace. Every
 * remote read uses `redactSecrets: true`, so a `role('secret')` field cannot
 * ride a response. Writes expose the settings service's merge, replacement,
 * and path-addressed operations, and classify every provider refusal as
 * `settings/conflict` or `settings/rejected` with the service's message.
 */
declare class SettingsController extends TypertRemoteService {
  static inject: string[];
  static Config: Schema<Config>;
  private readonly openPath;
  private readonly openTextFile;
  private readonly canOpenPath;
  private readonly auth;
  private readonly userNamespaces;
  /**
   * Register the settings namespace and mount the credentials namespace beside
   * it. Both namespaces stay registered when a provider is absent so calls can
   * return the configuration API's actionable missing-provider diagnostic.
   * @param ctx - Host context where settings and credential providers may be mounted.
   */
  constructor(ctx: Context, config?: Config, internals?: SettingsControllerInternals);
  /**
   * Describe every registered namespace for a configuration page: redacted
   * layered values plus the serialized schema the page renders its form from.
   * @returns provider writability, local-document presence, and one view per namespace.
   * @throws RemoteError when no settings provider is mounted.
   */
  describe(): SettingsDescribeValue;
  /**
   * Report whether this deployment can open an authored Agent preset directory natively.
   * @returns true when the matching open operation is available.
   */
  canOpenAgentPresetDirectory(): boolean;
  /**
   * Merge a patch into one namespace's stored user section.
   * @param ns - namespace key to write.
   * @param patch - fields to merge into the user section.
   * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
   * @returns the namespace's redacted view after the write.
   * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
   */
  update(ns: string, patch: Record<string, JsonValue>, expectedRevision: number | undefined): Promise<SettingsNamespaceView>;
  /**
   * Replace one namespace's stored user section wholesale.
   * @param ns - namespace key to write.
   * @param section - complete replacement user section.
   * @param expectedRevision - revision the caller read; `undefined` writes unconditionally.
   * @returns the namespace's redacted view after the write.
   * @throws RemoteError when the request is invalid, no provider is mounted, or the provider refuses the write.
   */
  replace(ns: string, section: Record<string, JsonValue>, expectedRevision: number | undefined): Promise<SettingsNamespaceView>;
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
  mutate(ns: string, ops: SettingsPathOpView[], expectedRevision: number | undefined): Promise<SettingsNamespaceView>;
  /**
   * Materialize the provider-owned settings document and open it in a native text editor.
   * @param signal - caller lifetime; abort terminates preparation or the native command.
   * @returns confirmation after the native opener accepts the document.
   * @throws RemoteError when no document exists, preparation fails, or opening fails.
   */
  openSettingsDocument(signal: AbortSignal): Promise<SettingsDocumentOpenValue>;
  /**
   * Open one user-authored Agent preset directory or return its path when no native opener exists.
   * @param agentPreset - preset id resolved against Host-owned roots.
   * @param signal - caller lifetime; abort terminates the native command.
   * @returns an opened confirmation or the resolved directory for text display.
   * @throws RemoteError when the preset is missing, read-only, invalid, or cannot be opened.
   */
  openAgentPresetDirectory(agentPreset: string, signal: AbortSignal): Promise<AgentPresetDirectoryOpenValue>;
  private write;
  /** Resolve the optional provider or report how to supply it. */
  private provider;
  private isAdministrator;
  private requireAdministrator;
  private requireNamespace;
}
//#endregion
export { type AgentPresetDirectoryOpenValue, Config, CredentialsController, SettingsController, SettingsController as default, SettingsControllerInternals, type SettingsDocumentOpenValue };