import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { pipeline } from "node:stream/promises";
//#region src/report-contract.ts
const REPORT_CHANNEL = "/soc-agent-reports";
const REPORT_TOOL_NAME = "mcp__soc_agent__generate_customer_report";
const REPORT_DOWNLOAD_PREFIX = `${REPORT_CHANNEL}/download/`;
const ARTIFACT_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/iu;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/u;
function validArtifactType(filename, mime) {
	if (typeof filename !== "string" || !filename || filename.length > 255 || /[\u0000-\u001f\u007f/\\]/u.test(filename)) return false;
	return mime === "application/pdf" && /\.pdf$/iu.test(filename) || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && /\.xlsx$/iu.test(filename);
}
//#endregion
//#region src/host.ts
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function failure(error) {
	const candidate = record(error) ? error : void 0;
	const message = error instanceof Error ? error.message : "The report operation failed.";
	return {
		ok: false,
		error: {
			code: typeof candidate?.code === "string" ? candidate.code : message === "authentication required" ? "authentication_required" : "report_operation_failed",
			message,
			details: {}
		}
	};
}
/** The signed-in app session is always supplied by the host, never the browser. */
async function reportSettingsEndpoint(auth, command, endpoint, payload) {
	try {
		const session = auth.requireSession();
		if (!session.id) throw new Error("authentication required");
		if (endpoint === "get-customer-settings") return {
			ok: true,
			value: await command("report-settings-get", { session_id: session.id })
		};
		if (endpoint === "save-customer-settings") {
			if (!record(payload) || !Array.isArray(payload.customers)) throw new Error("Enter a customer configuration list before saving.");
			return {
				ok: true,
				value: await command("report-settings-save", {
					session_id: session.id,
					customers: payload.customers
				})
			};
		}
		throw new Error("Unknown report settings operation.");
	} catch (error) {
		return failure(error);
	}
}
function validateStoredArtifact(value, id, sessionId) {
	if (!record(value) || value.id !== id || value.session_id !== sessionId || !validArtifactType(value.filename, value.mime_type) || typeof value.path !== "string" || !isAbsolute(value.path) || basename(value.path) !== value.filename || !Number.isSafeInteger(value.size_bytes) || value.size_bytes <= 0) throw new Error("The report artifact metadata is invalid.");
	return value;
}
function disposition(filename) {
	return `attachment; filename="${filename.replace(/[^\x20-\x7e]/gu, "_").replace(/["\\]/gu, "_")}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
/** Lookup authorizes user + conversation ownership before the host reads bytes. */
async function downloadReportArtifact(request, response, auth, command) {
	let handle;
	try {
		const session = auth.requireSession();
		if (!session.id) throw new Error("authentication required");
		if (request.method !== "GET" && request.method !== "HEAD") {
			response.writeHead(405, {
				allow: "GET, HEAD",
				"cache-control": "no-store"
			});
			response.end();
			return;
		}
		const url = new URL(request.url ?? "", "http://dsh.internal");
		const id = url.pathname.slice(REPORT_DOWNLOAD_PREFIX.length);
		const investigationId = url.searchParams.get("session_id");
		if (!url.pathname.startsWith(REPORT_DOWNLOAD_PREFIX) || !ARTIFACT_ID.test(id) || investigationId === null || !SESSION_ID.test(investigationId) || [...url.searchParams.keys()].length !== 1) {
			response.writeHead(404, { "cache-control": "no-store" });
			response.end("Report file not found.");
			return;
		}
		const artifact = validateStoredArtifact(await command("report-artifact-get", {
			session_id: session.id,
			artifact_id: id,
			investigation_id: investigationId
		}), id, investigationId);
		handle = await open(artifact.path, constants.O_RDONLY | constants.O_NOFOLLOW);
		const stat = await handle.stat();
		if (!stat.isFile() || stat.size !== artifact.size_bytes) throw new Error("The report artifact is missing or has changed.");
		response.writeHead(200, {
			"content-type": artifact.mime_type,
			"content-disposition": disposition(artifact.filename),
			"content-length": stat.size,
			"cache-control": "no-store",
			"x-content-type-options": "nosniff"
		});
		if (request.method === "HEAD") response.end();
		else await pipeline(handle.createReadStream({ autoClose: false }), response);
	} catch (error) {
		if (response.headersSent) response.destroy(error instanceof Error ? error : void 0);
		else {
			const denied = error instanceof Error && error.message === "authentication required";
			response.writeHead(denied ? 401 : 404, {
				"cache-control": "no-store",
				"x-content-type-options": "nosniff"
			});
			response.end(denied ? "Sign in to download this report." : "Report file not found or no longer available.");
		}
	} finally {
		await handle?.close();
	}
}
//#endregion
//#region src/index.ts
const inject = [
	"socAuth",
	"connection",
	"webServer"
];
function apply(ctx) {
	const host = ctx;
	const command = async (operation, payload) => {
		const { runAuthCommand } = await import("dsh-soc-agent/ownership");
		return await runAuthCommand(operation, payload);
	};
	host.effect(() => host.connection.rpc.handle(REPORT_CHANNEL, (endpoint, payload) => reportSettingsEndpoint(host.socAuth, command, endpoint, payload), { authority: "trusted-host" }), "soc-agent-reports: user settings channel");
	host.effect(() => host.webServer.register({
		kind: "prefix",
		path: `${REPORT_CHANNEL}/download`,
		handler: (request, response) => downloadReportArtifact(request, response, host.socAuth, command)
	}), "soc-agent-reports: authenticated downloads");
}
//#endregion
export { REPORT_CHANNEL, REPORT_TOOL_NAME, apply, downloadReportArtifact, inject, reportSettingsEndpoint, validateStoredArtifact };
