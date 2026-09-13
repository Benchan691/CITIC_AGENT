import { sessionFormatCatalog } from "@deepseek-ai/dsh-session-format-catalog";
import { link, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, resolve, toNamespacedPath } from "node:path";
import { performance } from "node:perf_hooks";
import { scheduler } from "node:timers/promises";
import { createHash, randomBytes } from "node:crypto";
import { SessionAlreadyOwnedError, SessionFormatUnsupportedError, sessionFormatVersionRefusal, validateStoredEvents } from "@deepseek-ai/dsh-session-persistence";
import { BlockAssembler, expandAssistantStream } from "@deepseek-ai/dsh-llm";
import { tryLockExclusive } from "@deepseek-ai/node-addon-system/flock";
import { SESSION_FORMAT_VERSION, Session, SessionLogOffset } from "@deepseek-ai/dsh-session";
import { SessionFormatUnsupportedMigrationError as SessionFormatUnsupportedMigrationError$1, parseSessionFormatLogFilename, sessionFormatLogFilename } from "@deepseek-ai/dsh-session-format";
import { assertV3RowAdmission } from "@deepseek-ai/dsh-session-format-v2-to-v3";
import { constants, createZstdCompress, createZstdDecompress, zstdCompress, zstdDecompress, zstdDecompressSync } from "node:zlib";
import { isDeepStrictEqual, promisify } from "node:util";
import { constants as constants$1 } from "node:buffer";
import { Readable, pipeline } from "node:stream";
//#region src/win32.ts
/**
* Windows durable namespace helpers for the JSONL backend.
*
* POSIX publishes a newly-created log by creating a directory entry and then
* fsyncing the parent directory. Windows does not expose that parent-directory
* fsync contract through Node, so the Windows path uses the native durable
* namespace primitive instead: create a staging object in the target directory
* and publish it with `MoveFileExW(..., MOVEFILE_WRITE_THROUGH)` without
* replacement or cross-volume copy fallback.
*
* @module dsh-session-persistence-jsonl/win32
*/
const MOVEFILE_WRITE_THROUGH = 8;
const WAIT_OBJECT_0 = 0;
const WAIT_TIMEOUT = 258;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_PATH_NOT_FOUND = 3;
const ERROR_ACCESS_DENIED = 5;
const ERROR_NOT_SAME_DEVICE = 17;
const ERROR_SHARING_VIOLATION = 32;
const ERROR_FILE_EXISTS = 80;
const ERROR_INVALID_NAME = 123;
const ERROR_ALREADY_EXISTS = 183;
let bindings;
/** Load the small Win32 API lazily so non-Windows processes never load Koffi. */
async function win32() {
	if (bindings !== void 0) return bindings;
	const kernel32 = (await import("koffi")).default.load("kernel32.dll");
	bindings = {
		moveFileExW: kernel32.func("__stdcall", "MoveFileExW", "int", [
			"str16",
			"str16",
			"uint"
		]),
		createSemaphoreW: kernel32.func("__stdcall", "CreateSemaphoreW", "intptr", [
			"void*",
			"int",
			"int",
			"str16"
		]),
		waitForSingleObject: kernel32.func("__stdcall", "WaitForSingleObject", "uint", ["intptr", "uint"]),
		releaseSemaphore: kernel32.func("__stdcall", "ReleaseSemaphore", "int", [
			"intptr",
			"int",
			"void*"
		]),
		closeHandle: kernel32.func("__stdcall", "CloseHandle", "int", ["intptr"]),
		getLastError: kernel32.func("__stdcall", "GetLastError", "uint", [])
	};
	return bindings;
}
function errnoCode(win32Code) {
	switch (win32Code) {
		case ERROR_FILE_NOT_FOUND:
		case ERROR_PATH_NOT_FOUND: return "ENOENT";
		case ERROR_ACCESS_DENIED: return "EACCES";
		case ERROR_NOT_SAME_DEVICE: return "EXDEV";
		case ERROR_SHARING_VIOLATION: return "EBUSY";
		case ERROR_FILE_EXISTS:
		case ERROR_ALREADY_EXISTS: return "EEXIST";
		case ERROR_INVALID_NAME: return "EINVAL";
		default: return "EIO";
	}
}
function win32Error(syscall, win32Code, path, dest) {
	const code = errnoCode(win32Code);
	const error = /* @__PURE__ */ new Error(`${syscall} ${code} (Win32 ${win32Code}): ${path} -> ${dest}`);
	error.code = code;
	error.errno = win32Code;
	error.syscall = syscall;
	error.path = path;
	error.dest = dest;
	error.win32Code = win32Code;
	return error;
}
function isENOENT(error) {
	return error?.code === "ENOENT";
}
function isEEXIST$1(error) {
	return error?.code === "EEXIST";
}
async function assertDirectory(path) {
	try {
		if ((await stat(path === parse(path).root ? path : toNamespacedPath(path))).isDirectory()) return true;
		const error = /* @__PURE__ */ new Error(`path exists but is not a directory: ${path}`);
		error.code = "ENOTDIR";
		error.path = path;
		throw error;
	} catch (error) {
		if (isENOENT(error)) return false;
		throw error;
	}
}
/**
* Publish `existing` at `replacement` with Windows write-through rename
* semantics. The destination must not already exist; the move must stay within
* the volume (no copy fallback flag is set).
* @param existing - the synced staging path to move.
* @param replacement - the final path, which must not already exist.
*/
async function publishNewFileWin32(existing, replacement) {
	const api = await win32();
	if (api.moveFileExW(toNamespacedPath(existing), toNamespacedPath(replacement), MOVEFILE_WRITE_THROUGH) === 0) throw win32Error("MoveFileExW", api.getLastError(), existing, replacement);
}
/**
* Acquire the session write lock as a named kernel semaphore (count 1) whose
* name is derived from the canonical lock path. A kernel object never touches
* the filesystem, so readers, searches, and directory removal proceed freely
* while the lock is held; a second acquirer's zero-timeout wait times out
* (`EBUSY`); and when the last handle closes — including on any process
* death — the object is destroyed, so a successor's create starts fresh.
* @param path - the lock file path the name is derived from (case-folded:
*   Windows paths are case-insensitive).
* @returns the open semaphore handle, released via {@link releaseLockHandleWin32}.
*/
async function acquireLockHandleWin32(path) {
	const api = await win32();
	const name = `Local\\dsh-session-lock-${createHash("sha256").update(resolve(path).toLowerCase()).digest("hex")}`;
	const handle = api.createSemaphoreW(null, 1, 1, name);
	if (handle === 0) throw win32Error("CreateSemaphoreW", api.getLastError(), path, name);
	const wait = api.waitForSingleObject(handle, 0);
	if (wait === WAIT_OBJECT_0) return handle;
	api.closeHandle(handle);
	if (wait === WAIT_TIMEOUT) throw win32Error("WaitForSingleObject", ERROR_SHARING_VIOLATION, path, name);
	throw win32Error("WaitForSingleObject", api.getLastError(), path, name);
}
/**
* Release a lock from {@link acquireLockHandleWin32}: restore the semaphore
* count and close the handle (the object dies with its last handle).
* @param handle - the open semaphore handle.
*/
async function releaseLockHandleWin32(handle) {
	const api = await win32();
	const released = api.releaseSemaphore(handle, 1, null);
	const closed = api.closeHandle(handle);
	if (released === 0 || closed === 0) throw win32Error("ReleaseSemaphore", api.getLastError(), `handle:${handle}`, `handle:${handle}`);
}
/**
* Create `target` and its missing ancestors with durable Windows namespace
* publication. Each missing directory is first created as a random staging
* sibling, then moved to its final name with `MOVEFILE_WRITE_THROUGH`; races
* with another creator are accepted only after verifying the winner is a
* directory.
* @param target - the absolute directory path to create durably when absent.
*/
async function ensureDurableDirectoryWin32(target) {
	const absolute = resolve(target);
	const root = parse(absolute).root;
	await assertDirectory(root);
	const segments = absolute.slice(root.length).split(/[\\/]+/).filter((part) => part.length > 0);
	let current = root;
	for (const segment of segments) {
		const next = join(current, segment);
		if (!await assertDirectory(next)) await createLeafDirectoryWin32(current, next);
		current = next;
	}
}
async function createLeafDirectoryWin32(parent, target) {
	const staging = await mkdtemp(toNamespacedPath(join(parent, ".dsh-mkdir-")));
	try {
		await publishNewFileWin32(staging, target);
	} catch (error) {
		await rm(staging, {
			recursive: true,
			force: true
		});
		if (isEEXIST$1(error) && await assertDirectory(target)) return;
		throw error;
	}
}
//#endregion
//#region src/lease.ts
/**
* Cross-process write-ownership lock for one session's artifact directory,
* held for the whole life of a write handle. The arbiter is the kernel:
* POSIX takes a non-blocking `flock(2)` via native system support on `session.lock`
* beside the log, and Windows holds a named kernel semaphore derived from
* that path — never a file lock or handle, so readers, searches, and
* directory removal proceed freely while the lock is held. Contention maps
* to `SessionAlreadyOwnedError`; the kernel releases the lock when the
* holder's descriptor or last object handle closes, including on any process
* death, so a crashed holder never blocks a successor. A live but wedged
* holder keeps the lock until its process exits: there is deliberately no
* expiry that could expropriate a stalled writer whose resumed appends would
* tear the log.
* A POSIX lock names an inode, not a path, so after locking the holder
* verifies the locked inode is still the file at the lock path and retries
* otherwise: an unlinked-and-recreated lock file carries a fresh inode, and
* a lock on the orphaned one proves nothing. Removing a live session's lock
* file therefore forfeits exclusion on POSIX (nothing in the harness does
* so); Windows has no lock file at all. Readers never touch the lock.
* The lock is acquired at write-open of an existing artifact and, for a
* created session, only right before its first materializing write — an
* unmaterialized session has no filesystem footprint. Release never removes
* the POSIX lock file: every acquired lock belongs to a materialized or
* materializing session, and the surviving file keeps the stable inode later
* lockers verify against. The browser worker stubs the native flock entry to
* immediate success: it is single-process, so the in-process write claim
* already excludes every writer.
* @module dsh-soc-agent-session-persistence-jsonl/lease
*/
/** Base name of the kernel lock file inside a session's directory. */
const LEASE_FILENAME = "session.lock";
/** Whether a flock failure means another descriptor holds the lock. */
function isLockContention(error) {
	const code = error?.code;
	return code === "EAGAIN" || code === "EWOULDBLOCK";
}
/**
* One held write lock. Constructed only by {@link SessionWriteLease.acquire};
* `release` closes the descriptor or handle, which is what releases the lock.
*/
var SessionWriteLease = class SessionWriteLease {
	held;
	released = false;
	constructor(held) {
		this.held = held;
	}
	/**
	* Acquire the session directory's kernel write lock.
	* @param dir - the session's artifact directory (created if absent).
	* @param id - the session the lock guards, for error identities.
	* @returns the held lock.
	* @throws {SessionAlreadyOwnedError} while another holder keeps the lock.
	*/
	static async acquire(dir, id) {
		const path = join(dir, LEASE_FILENAME);
		await mkdir(dir, {
			recursive: true,
			mode: 448
		});
		/* v8 ignore start -- native Windows coverage exercises this platform branch; Linux covers the POSIX peer */
		if (process.platform === "win32") {
			let handle;
			try {
				handle = await acquireLockHandleWin32(path);
			} catch (error) {
				if (error?.code === "EBUSY") throw new SessionAlreadyOwnedError(id);
				throw error;
			}
			return new SessionWriteLease({
				kind: "win32",
				handle
			});
		}
		/* v8 ignore stop */
		for (let attempt = 0; attempt < 3; attempt += 1) {
			const handle = await open(path, "w");
			try {
				try {
					await tryLockExclusive(handle.fd);
				} catch (error) {
					if (isLockContention(error)) throw new SessionAlreadyOwnedError(id);
					throw error;
				}
				const held = await handle.stat({ bigint: true });
				const current = await stat(path, { bigint: true }).catch((error) => {
					if (error?.code === "ENOENT") return void 0;
					throw error;
				});
				if (current !== void 0 && current.ino === held.ino && current.dev === held.dev) return new SessionWriteLease({
					kind: "posix",
					handle
				});
			} catch (error) {
				await handle.close();
				throw error;
			}
			await handle.close();
		}
		throw new SessionAlreadyOwnedError(id);
	}
	/**
	* Release the kernel lock by closing its descriptor or handle. The POSIX
	* lock file is never removed: every acquired lock belongs to a
	* materialized or materializing session, and keeping the file preserves
	* the stable inode later lockers verify against. Idempotent.
	*/
	async release() {
		if (this.released) return;
		this.released = true;
		/* v8 ignore start -- native Windows coverage exercises this platform branch; Linux covers the POSIX peer */
		if (this.held.kind === "win32") {
			await releaseLockHandleWin32(this.held.handle);
			return;
		}
		/* v8 ignore stop */
		await this.held.handle.close();
	}
};
//#endregion
//#region src/format.ts
/**
* On-disk format helpers for the JSONL session-persistence backend: path
* sanitization (a {@link SessionId} is an unvalidated branded string, so it
* MUST be encoded before use in a path — no traversal, no collision), the
* per-project/session directory layout, header-line (de)serialization, and the
* truncation-repair offset computation.
*
* @module dsh-session-persistence-jsonl/format
*/
/**
* Return the artifact suffix for one physical encoding.
* @param compression - configured JSONL artifact encoding.
* @returns `.jsonl.zstd` for Zstandard or `.jsonl` for plaintext.
*/
function logSuffix(compression) {
	return `.jsonl${compressionSuffix(compression)}`;
}
function compressionSuffix(compression) {
	return compression === "zstd" ? ".zstd" : "";
}
/**
* Return the canonical filename for one immutable Session format generation.
* Version zero retains the original suffix-only name; every later generation
* carries a lowercase numeric `vN` component.
* @param version - non-negative safe Session format version.
* @param compression - configured JSONL artifact encoding.
* @returns the generation filename inside one Session directory.
*/
function generationLogFilename(version, compression) {
	return `${sessionFormatLogFilename(version)}${compressionSuffix(compression)}`;
}
/**
* Parse one canonical generation filename for the selected physical encoding.
* Noncanonical, temporary, uppercase, leading-zero, and version-zero-tagged names do
* not identify committed generations.
* @param filename - one entry from a Session directory.
* @param compression - configured JSONL artifact encoding.
* @returns its format version, or `undefined` when the name is not canonical.
*/
function parseGenerationLogFilename(filename, compression) {
	const suffix = compressionSuffix(compression);
	if (!filename.endsWith(suffix)) return void 0;
	return parseSessionFormatLogFilename(filename.slice(0, filename.length - suffix.length));
}
const HEADER_REQUIRED_KEYS = [
	"type",
	"version",
	"id",
	"createdAt",
	"isSeeded",
	"delegationDepth"
];
const HEADER_OPTIONAL_KEYS = [
	"cwd",
	"parentSession",
	"origin",
	"agentPreset"
];
const HEADER_KEYS = /* @__PURE__ */ new Set([...HEADER_REQUIRED_KEYS, ...HEADER_OPTIONAL_KEYS]);
/**
* Refuse policy fields that never belong to a released Session header.
* @param value - parsed physical header candidate.
* @returns nothing after successful validation.
*/
function assertNoRetiredHeaderFields(value) {
	if (typeof value !== "object" || value === null) return;
	if (Object.hasOwn(value, "sandboxMode") || Object.hasOwn(value, "approvalPolicy")) throw new Error("session header uses retired policy baseline fields");
}
/**
* Build the header line object from a {@link SessionHeader}.
* @param header - the immutable session metadata to serialize.
* @param inheritedEventCount - exact inherited prefix length; required for a
* seeded header and omitted only for an unseeded header.
* @returns the `type: 'session'`-tagged line object, absent optional fields omitted (never null).
*/
function toHeaderLine(header, inheritedEventCount) {
	if (header.isSeeded && inheritedEventCount === void 0) throw new Error("seeded session header requires an inherited event count");
	const cut = SessionLogOffset(inheritedEventCount ?? 0);
	if (!header.isSeeded && cut !== 0) throw new Error("unseeded session header inherited event count must be 0");
	return sessionFormatCatalog.encodeCurrentHeader({
		...header,
		delegationDepth: header.delegationDepth ?? 0
	}, cut);
}
/**
* Translate one current physical header into logical metadata and its cut.
* @param line - the shape-checked first line of a log (see the `isHeaderLine` guard).
* @returns logical Session metadata paired with the exact inherited prefix length.
*/
function fromHeaderLine(line) {
	return {
		meta: {
			version: SESSION_FORMAT_VERSION,
			id: line.id,
			createdAt: line.createdAt,
			...line.cwd !== void 0 ? { cwd: line.cwd } : {},
			...line.parentSession !== void 0 ? { parentSession: line.parentSession } : {},
			isSeeded: line.isSeeded,
			...line.origin !== void 0 ? { origin: line.origin } : {},
			delegationDepth: line.delegationDepth,
			...line.agentPreset !== void 0 ? { agentPreset: line.agentPreset } : {}
		},
		inheritedEventCount: SessionLogOffset(0)
	};
}
/** Type guard: a parsed first line is a well-formed session header. */
function isHeaderLine(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) && HEADER_REQUIRED_KEYS.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => HEADER_KEYS.has(key)) && value.type === "session" && typeof value.version === "number" && typeof value.id === "string" && typeof value.createdAt === "number" && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0 && !Object.is(value.createdAt, -0) && typeof value.delegationDepth === "number" && Number.isSafeInteger(value.delegationDepth) && value.delegationDepth >= 0 && !Object.is(value.delegationDepth, -0) && (value.cwd === void 0 || typeof value.cwd === "string" && isAbsolute(value.cwd)) && (value.parentSession === void 0 || typeof value.parentSession === "string") && typeof value.isSeeded === "boolean" && (value.origin === void 0 || value.origin === "subagent") && (value.agentPreset === void 0 || typeof value.agentPreset === "string");
}
/**
* Encode an arbitrary string as a single safe path segment, injectively over ALL JS (UTF-16)
* strings — including lone surrogates. A {@link SessionId} is an unvalidated branded string,
* so this neutralizes `../`, absolute paths, NUL, and separators before any filesystem use.
* Safe code units remain literal; every other unit, including `~`, becomes
* `~XXXX`. Operating on code units preserves lone surrogates, while special-
* casing `.` and `..` prevents traversal by an otherwise safe whole segment.
*
* @param raw - the string to encode; must be non-empty (throws on `''`).
* @returns the escaped single path segment, decodable back to `raw`.
*/
function encodeSegment(raw) {
	if (raw.length === 0) throw new Error("cannot encode an empty path segment");
	if (raw === ".") return "~002E";
	if (raw === "..") return "~002E~002E";
	let out = "";
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
		else out += "~" + code.toString(16).toUpperCase().padStart(4, "0");
	}
	return out;
}
/**
* Build the readable directory key for a project path.
* Filesystem separators and drive separators become `-`; unsafe code units use
* the same `~XXXX` escape as session ids. The key is bounded for filesystem
* component limits. Separator replacement and truncation are intentionally
* lossy, following the common human-navigable project-directory convention.
* @param cwd - the session's project directory.
* @returns a single filesystem-safe project directory name.
*/
function projectKey(cwd) {
	if (cwd.length === 0) throw new Error("cannot encode an empty project path");
	let readable = "";
	let separatorRun = false;
	for (let i = 0; i < cwd.length; i++) {
		const code = cwd.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch === "/" || ch === "\\" || ch === ":") {
			if (!separatorRun) readable += "-";
			separatorRun = true;
		} else if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) {
			readable += ch;
			separatorRun = false;
		} else {
			readable += "~" + code.toString(16).toUpperCase().padStart(4, "0");
			separatorRun = false;
		}
	}
	return `--${(readable.replace(/^-+/, "") || "root").slice(0, 251)}--`;
}
/**
* The configured root's human-navigable project directory. A configured root
* may be local or shared; this grouping does not prescribe its deployment.
* @param root - the backend's session root directory.
* @param cwd - the session's project directory; `undefined` selects `_no-cwd`.
* @returns the project directory path under `root`.
*/
function projectDir(root, cwd) {
	if (cwd === void 0) return join(root, "_no-cwd");
	return join(root, projectKey(cwd));
}
/**
* The directory owned by one session and available for future session-local
* artifacts.
* @param root - the backend's session root directory.
* @param cwd - the session's project directory.
* @param id - the session id, encoded to one safe path segment.
* @returns the session directory beneath its project directory.
*/
function sessionDir(root, cwd, id) {
	return join(projectDir(root, cwd), encodeSegment(id));
}
/**
* Build one immutable Session format generation path.
* @param root - the backend's session root directory.
* @param cwd - the session's project directory (`undefined` → `_no-cwd`).
* @param id - the session id, path-encoded via {@link encodeSegment} before filesystem use.
* @param version - physical Session format generation.
* @param compression - physical artifact encoding and filename suffix.
* @returns the selected generation's configured JSONL artifact path.
*/
function generationLogPath(root, cwd, id, version, compression) {
	return join(sessionDir(root, cwd, id), generationLogFilename(version, compression));
}
/**
* Build the current generation's append target path for a Session.
* @param root - the backend's session root directory.
* @param cwd - the session's project directory (`undefined` → `_no-cwd`).
* @param id - the session id, path-encoded via {@link encodeSegment} before filesystem use.
* @param compression - physical artifact encoding and filename suffix.
* @returns the current Session format generation path.
*/
function logPath(root, cwd, id, compression) {
	return generationLogPath(root, cwd, id, SESSION_FORMAT_VERSION, compression);
}
/**
* Serialize a current event batch as JSONL lines (no trailing newline). Compact
* Assistant streams are nested event data; every event occupies one row.
* @param events - the batch to serialize, in log order.
* @returns the batch's JSONL text; the writer adds the final newline.
*/
function eventLines(events) {
	return events.map(eventLine).join("\n");
}
/**
* Serialize one current event as one JSONL record without its trailing newline.
* @param event - current event to encode.
* @returns one physical JSON record.
*/
function eventLine(event) {
	return JSON.stringify(sessionFormatCatalog.encodeCurrentEvent(event));
}
/**
* Refuse a header carrying a format version this build does not read BEFORE
* validating the current header shape or decoding any event row: a future
* format need not satisfy this build's structural checks at all, and its user
* must see "upgrade the harness", never "corrupt session log".
* @param parsed - the JSON-parsed first line of a session artifact.
*/
function refuseForeignFormatVersion(parsed) {
	const { version, id } = parsed;
	if (typeof version !== "number" || version === SESSION_FORMAT_VERSION) return;
	throw new SessionFormatUnsupportedError(sessionFormatVersionRefusal(typeof id === "string" ? id : String(id), version));
}
/** Parse one complete header record supplied independently from event rows. */
function parseHeaderRecord(record) {
	if (record.length === 0 || record.at(-1) !== 10 || record.indexOf(10) !== record.length - 1) throw new Error("empty or header-less session log");
	let parsed;
	try {
		parsed = JSON.parse(record.subarray(0, -1).toString("utf8"));
	} catch {
		throw new Error("corrupt session log: header line is not valid JSON");
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("corrupt session log: first line is not a JSON object");
	refuseForeignFormatVersion(parsed);
	assertNoRetiredHeaderFields(parsed);
	if (!isHeaderLine(parsed)) throw new Error("corrupt session log: first line is not a session header");
	let restore;
	try {
		restore = sessionFormatCatalog.createRestore(parsed, {
			recovery: "strict",
			validation: "transformed"
		});
	} catch {
		/* v8 ignore next -- isHeaderLine matches the current codec; this preserves classification if it tightens. */
		throw new Error("corrupt session log: first line is not a session header");
	}
	return {
		meta: fromHeaderLine(parsed).meta,
		restore
	};
}
/**
* Incrementally scan complete JSONL event records after an independently
* supplied header record. Newline search and byte offsets stay on raw buffers;
* only complete records are decoded to UTF-8. A fragment crossing writes is
* copied because a decoder may reuse its output buffer after `write()` returns.
*/
var SessionLogScanner = class {
	recovery;
	meta;
	restore;
	eventCount = 0;
	fragments = [];
	fragmentBytes = 0;
	inputBytes;
	committedBytes;
	eventLine = 0;
	issue;
	finished = false;
	/**
	* Create an event scanner from exactly one newline-terminated header record.
	* @param headerRecord - the complete first JSONL record, including its newline.
	*/
	constructor(headerRecord, recovery = "recoverable") {
		this.recovery = recovery;
		const parsed = parseHeaderRecord(headerRecord);
		this.meta = parsed.meta;
		this.restore = parsed.restore;
		this.inputBytes = headerRecord.length;
		this.committedBytes = headerRecord.length;
	}
	/**
	* Consume the next raw plaintext chunk, retaining only an incomplete final record.
	* @param chunk - bytes immediately following all previously supplied bytes.
	*/
	write(chunk) {
		if (this.finished) throw new Error("cannot write to a finished session log scanner");
		const chunkStart = this.inputBytes;
		this.inputBytes += chunk.length;
		let lineStart = 0;
		for (let newline = chunk.indexOf(10); newline !== -1; newline = chunk.indexOf(10, lineStart)) {
			const fragment = chunk.subarray(lineStart, newline);
			let line = fragment;
			if (this.fragments.length > 0) {
				if (fragment.length > 0) this.fragments.push(fragment);
				line = Buffer.concat(this.fragments, this.fragmentBytes + fragment.length);
				this.fragments = [];
				this.fragmentBytes = 0;
			}
			this.consumeEventLine(line, chunkStart + newline + 1);
			lineStart = newline + 1;
		}
		if (lineStart < chunk.length) {
			const fragment = Buffer.from(chunk.subarray(lineStart));
			this.fragments.push(fragment);
			this.fragmentBytes += fragment.length;
		}
	}
	/**
	* Snapshot progress before appending a recoverable torn-frame prefix.
	* @returns byte, committed-prefix, and expanded-event cursors.
	*/
	checkpoint() {
		return {
			inputBytes: this.inputBytes,
			committedBytes: this.committedBytes,
			eventCount: SessionLogOffset(this.eventCount)
		};
	}
	/**
	* Finish scanning, ignoring a final record without a newline as a torn tail.
	* @returns the header, contiguous event prefix, and safe truncation offset.
	*/
	finish() {
		this.finished = true;
		const artifact = this.restore.finish();
		return {
			meta: this.meta,
			inheritedEventCount: SessionLogOffset(artifact.inheritedEventCount),
			events: artifact.events,
			committedBytes: this.committedBytes
		};
	}
	/** Decode one complete event row and update the contiguous prefix. */
	consumeEventLine(line, endByte) {
		this.eventLine += 1;
		let decoded;
		try {
			decoded = JSON.parse(line.toString("utf8"));
		} catch {
			const issue = /* @__PURE__ */ new Error(`corrupt session log: unparsable committed event at line ${this.eventLine}`);
			if (this.recovery === "strict") throw issue;
			this.issue ??= issue;
			return;
		}
		try {
			assertV3RowAdmission(decoded);
		} catch (error) {
			if (error instanceof SessionFormatUnsupportedMigrationError$1) throw new SessionFormatUnsupportedError(error.message);
			throw error;
		}
		if (this.issue !== void 0) {
			if (typeof decoded === "object" && decoded !== null && decoded.type === "turn/end") throw this.issue;
			return;
		}
		try {
			this.restore.decodeRow(decoded);
		} catch (error) {
			/* v8 ignore next -- every production Session format decoder rejects with Error. */
			const detail = error instanceof Error ? error.message : String(error);
			const issue = new Error(`corrupt session log: invalid committed event at line ${this.eventLine}: ${detail}`, { cause: error });
			if (this.recovery === "strict") throw issue;
			this.issue = issue;
			if (typeof decoded === "object" && decoded !== null && decoded.type === "turn/end") throw issue;
			return;
		}
		this.eventCount += 1;
		this.committedBytes = endByte;
	}
};
/**
* Parse a complete or torn JSONL buffer into its preserved event prefix. This
* compatibility wrapper supplies the first record separately, then delegates
* event rows to {@link SessionLogScanner}.
*
* @param buffer - the raw bytes of the log file (header line first).
* @returns the header, preserved event prefix, and byte offset safe to append at.
*/
function scanLog(buffer) {
	const headerEnd = buffer.indexOf(10);
	if (headerEnd === -1) throw new Error("empty or header-less session log");
	const scanner = new SessionLogScanner(buffer.subarray(0, headerEnd + 1));
	scanner.write(buffer.subarray(headerEnd + 1));
	return scanner.finish();
}
//#endregion
//#region src/zstd-private-decoder.ts
/**
* Node-private synchronous Zstandard frame decoder optimization.
* @module dsh-session-persistence-jsonl/zstd-private-decoder
*/
const DECODE_CHUNK_SIZE = 1024 * 1024;
/** Return the stream with its observed private Node contract, or reject that optimization. */
function privateZstdStream(stream) {
	const candidate = stream;
	const handle = candidate._handle;
	const errorKey = Reflect.ownKeys(stream).find((key) => typeof key === "symbol" && key.description === "kError");
	/* v8 ignore next -- one test runtime exposes one Node-private shape; the Node 22/24/26 matrix checks compatibility. */
	if (typeof handle !== "object" || handle === null || typeof handle.writeSync !== "function" || !(candidate._writeState instanceof Uint32Array) || candidate._writeState.length < 2 || typeof candidate._defaultFlushFlag !== "number" || errorKey === void 0 || candidate[errorKey] !== null) return void 0;
	return {
		stream,
		errorKey
	};
}
/**
* Synchronous multi-frame decoder backed by one Node Zstd stream handle. Node
* exposes synchronous decoding only as a one-shot API, so this adapter uses
* the stream's private handle contract to reuse its native context and output
* chunks across frames.
*/
var NodePrivateZstdFrameDecoder = class NodePrivateZstdFrameDecoder {
	stream;
	errorKey;
	output = Buffer.allocUnsafe(DECODE_CHUNK_SIZE);
	decoderError;
	started = false;
	closed = false;
	constructor(stream, errorKey) {
		this.stream = stream;
		this.errorKey = errorKey;
		this.stream.on("error", (error) => {
			this.decoderError ??= error;
		});
	}
	/**
	* Create the optimized decoder when this Node release exposes the expected
	* private stream shape.
	* @returns a shared decoder, or `undefined` when callers must use the public fallback.
	*/
	static create() {
		const stream = createZstdDecompress({ chunkSize: DECODE_CHUNK_SIZE });
		const privateAccess = privateZstdStream(stream);
		/* v8 ignore next -- reached only when a supported Node release changes its private stream shape. */
		if (privateAccess !== void 0) return new NodePrivateZstdFrameDecoder(privateAccess.stream, privateAccess.errorKey);
		/* v8 ignore next -- the active Node runtime passed the private-shape probe above. */
		stream.close();
	}
	/** @inheritdoc */
	*decode(source, frames) {
		if (this.started) throw new Error("Zstandard frame decoder was already started");
		if (this.closed) throw new Error("cannot start a closed Zstandard frame decoder");
		this.started = true;
		try {
			for (const frame of frames) try {
				yield this.decodeFrame(source.subarray(frame.start, frame.end));
			} catch (error) {
				throw new Error(`corrupt Zstandard session log: frame at byte ${frame.start} failed validation`, { cause: error });
			}
		} finally {
			this.close();
		}
	}
	/** Decode one frame; its returned scratch view remains valid until the next call. */
	decodeFrame(input) {
		const handle = this.stream._handle;
		/* v8 ignore next -- decode() rejects closed instances before entering this private frame operation. */
		if (this.closed || handle === null) throw new Error("cannot decode with a closed Zstandard frame decoder");
		let inputOffset = 0;
		let inputRemaining = input.length;
		let outputBytes = 0;
		const fullChunks = [];
		for (;;) {
			handle.writeSync(this.stream._defaultFlushFlag, input, inputOffset, inputRemaining, this.output, 0, this.output.length);
			if (this.decoderError !== void 0) throw this.decoderError;
			const internalError = this.stream[this.errorKey];
			if (internalError !== null) {
				if (internalError instanceof Error) throw internalError;
				throw new Error("Zstandard decoder exposed a non-Error internal failure");
			}
			const outputAfter = this.stream._writeState[0];
			const inputAfter = this.stream._writeState[1];
			const consumed = inputRemaining - inputAfter;
			const produced = this.output.length - outputAfter;
			if (produced > 0) {
				outputBytes += produced;
				/* v8 ignore next -- Buffer cannot materialize a frame beyond its own process-wide maximum length. */
				if (outputBytes > constants$1.MAX_LENGTH) throw new Error(`Zstandard frame output exceeds ${constants$1.MAX_LENGTH} bytes`);
			}
			if (outputAfter !== 0) {
				/* v8 ignore next -- structurally scanned ranges contain exactly one complete frame and no trailing bytes. */
				if (inputAfter !== 0) throw new Error("Zstandard frame decoder left trailing input");
				const finalChunk = this.output.subarray(0, produced);
				if (fullChunks.length === 0) return finalChunk;
				if (produced > 0) fullChunks.push(Buffer.from(finalChunk));
				const onlyChunk = fullChunks[0];
				return fullChunks.length === 1 ? onlyChunk : Buffer.concat(fullChunks, outputBytes);
			}
			fullChunks.push(Buffer.from(this.output));
			inputOffset += consumed;
			inputRemaining = inputAfter;
		}
	}
	/** @inheritdoc */
	close() {
		if (this.closed) return;
		this.closed = true;
		this.stream.close();
	}
};
//#endregion
//#region src/zstd-public-decoder.ts
/**
* Public-API synchronous Zstandard frame decoder fallback.
* @module dsh-session-persistence-jsonl/zstd-public-decoder
*/
/** Multi-frame adapter built exclusively from Node's supported one-shot API. */
var PublicZstdFrameDecoder = class {
	started = false;
	closed = false;
	/** @inheritdoc */
	*decode(source, frames) {
		if (this.started) throw new Error("Zstandard frame decoder was already started");
		if (this.closed) throw new Error("cannot start a closed Zstandard frame decoder");
		this.started = true;
		try {
			for (const { start, end } of frames) {
				let decoded;
				try {
					decoded = zstdDecompressSync(source.subarray(start, end));
				} catch (error) {
					throw new Error(`corrupt Zstandard session log: frame at byte ${start} failed validation`, { cause: error });
				}
				yield decoded;
			}
		} finally {
			this.close();
		}
	}
	/** @inheritdoc */
	close() {
		this.closed = true;
	}
};
//#endregion
//#region src/zstd.ts
/**
* Zstandard frame primitives for the JSONL persistence backend. The backend
* owns a concatenated-frame container so it can append and recover batches
* without exposing compression mechanics through the persistence seam.
* @module dsh-session-persistence-jsonl/zstd
*/
const ZSTD_MAGIC = 4247762216;
const zstdCompressAsync = promisify(zstdCompress);
const zstdDecompressAsync = promisify(zstdDecompress);
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
const INCOMPLETE_FRAME_OPTIONS = { finishFlush: constants.ZSTD_e_flush };
/**
* Locate complete frames without decompressing their blocks. Invalid complete
* structure rejects; EOF inside the final frame returns its start for repair.
* @param buffer - complete bytes currently present in the session artifact.
* @param maxFrames - optional complete-frame limit for metadata-only readers.
* @returns complete frame ranges and an optional incomplete-final-frame start.
*/
function scanZstdFrames(buffer, maxFrames = Number.POSITIVE_INFINITY) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
		if (frames.length === maxFrames) return { frames };
	}
	return { frames };
}
/**
* Compress one independently decodable, checksummed Zstandard frame.
* @param input - JSONL bytes for a header or durable event batch.
* @returns the complete encoded frame.
*/
async function compressZstdFrame(input) {
	return zstdCompressAsync(input, CHECKSUM_OPTIONS);
}
/**
* Decompress one complete frame and validate its checksum.
* @param input - one structurally complete Zstandard frame.
* @returns the frame plaintext.
*/
async function decompressZstdFrame(input) {
	return zstdDecompressAsync(input);
}
/**
* Select the shared private decoder when the running Node 22/24/26 shape is
* compatible, otherwise preserve correctness with the public one-shot API.
* @returns a synchronous decoder with an implementation-independent lifecycle.
*/
function createZstdFrameDecoder() {
	return NodePrivateZstdFrameDecoder.create() ?? new PublicZstdFrameDecoder();
}
/**
* Recover available plaintext from a structurally incomplete final frame.
* `ZSTD_e_flush` deliberately suppresses final-frame and checksum completion;
* callers must establish the torn frame boundary before using this helper.
* @param input - available bytes from a known incomplete Zstandard frame.
* @returns plaintext produced from the available input.
*/
async function decompressZstdPrefix(input) {
	return zstdDecompressAsync(input, INCOMPLETE_FRAME_OPTIONS);
}
//#endregion
//#region src/generation.ts
/**
* Durable whole-generation publication for JSONL Session artifacts.
*
* Format packages transform parsed JSON values. This module owns the physical
* encoding, exact source identity, immutable generation files, and exclusive
* current-generation publication for both configured JSONL suffixes.
* @module dsh-soc-agent-session-persistence-jsonl/generation
*/
/** Internal scheduling bounds: preserve old decode cadence and cap each synchronous encode slice. */
const MIGRATION_DECODE_YIELD_INTERVAL_MS = 500;
const MIGRATION_WORK_CHUNK_BYTES = 1024 * 1024;
const MIGRATION_WRITE_CHUNK_BYTES = 4 * 1024 * 1024;
const ZSTD_CHECKSUM_OPTIONS = {
	chunkSize: MIGRATION_WORK_CHUNK_BYTES,
	params: { [constants.ZSTD_c_checksumFlag]: 1 }
};
/** A historical source changed after its single decode and migration pass. */
var JsonlGenerationSourceChangedError = class extends Error {
	path;
	name = "JsonlGenerationSourceChangedError";
	/** @param path - historical generation whose revision changed. */
	constructor(path) {
		super(`historical session generation changed during migration: "${path}"`);
		this.path = path;
	}
};
/** A historical artifact is intact, but the format edge refuses its contents. */
var JsonlGenerationUnsupportedMigrationError = class extends Error {
	fromVersion;
	reason;
	name = "JsonlGenerationUnsupportedMigrationError";
	/**
	* @param fromVersion - unchanged source generation version.
	* @param reason - format-edge refusal.
	*/
	constructor(fromVersion, reason) {
		super(reason.message, { cause: reason });
		this.fromVersion = fromVersion;
		this.reason = reason;
	}
};
/** A current-generation filename already names different or invalid bytes. */
var JsonlGenerationTargetConflictError = class extends Error {
	path;
	reason;
	name = "JsonlGenerationTargetConflictError";
	/**
	* @param path - immutable target that prevented exclusive publication.
	* @param reason - why the existing target cannot be accepted.
	*/
	constructor(path, reason) {
		super(`current session generation already exists at "${path}": ${reason.message}`, { cause: reason });
		this.path = path;
		this.reason = reason;
	}
};
const defaultFileSystem = {
	open: (path, flags, mode) => open(path, flags, mode),
	readFile: (path, signal) => readFile(path, signal === void 0 ? void 0 : { signal }),
	readdir: (path) => readdir(path),
	stat: (path) => stat(path, { bigint: true }),
	lstat: (path) => lstat(path),
	link,
	rm: (path) => rm(path, { force: true })
};
const defaultInternals = {
	fs: defaultFileSystem,
	randomToken: () => randomBytes(8).toString("hex"),
	platform: process.platform,
	publishNewWin32: publishNewFileWin32,
	barrier: () => {}
};
function isEEXIST(error) {
	return error?.code === "EEXIST";
}
/** Whether a filesystem-owned failure should retain its original errno and path. */
function isErrnoException(error) {
	return typeof error?.code === "string";
}
function identity(value) {
	return [
		value.dev,
		value.ino,
		value.size,
		value.mtimeNs,
		value.ctimeNs
	].join(":");
}
/**
* Read one stable revision of a JSONL file with a single retry. If an append
* overlaps both reads, return the second read's committed pre-read prefix
* instead of starving behind a continuous writer.
* @param path - the generation file to read.
* @param signal - optional cancellation for the stat/read work.
* @returns the stable bytes (or the committed prefix) and their stat identity.
*/
async function readStableJsonlFile(path, signal) {
	return defaultGenerationRuntime.readStable(path, signal);
}
async function readStableSnapshot(path, signal, fs) {
	signal?.throwIfAborted();
	let before = await fs.stat(path);
	for (let attempt = 0;; attempt += 1) {
		const bytes = await fs.readFile(path, signal);
		signal?.throwIfAborted();
		const after = await fs.stat(path);
		if (identity(before) === identity(after)) {
			signal?.throwIfAborted();
			return {
				bytes,
				identity: after
			};
		}
		if (attempt === 1) return {
			bytes: bytes.subarray(0, Number(before.size)),
			identity: before
		};
		before = after;
	}
}
/** Parse the version discriminator without validating any version-specific field. */
function storedVersion(header) {
	if (typeof header !== "object" || header === null || Array.isArray(header)) throw new Error("corrupt session log: first line is not a JSON object");
	const version = header.version;
	if (!Number.isSafeInteger(version) || version < 0 || Object.is(version, -0)) throw new Error("corrupt session log: header version is not a non-negative safe integer");
	return version;
}
function parseJson(text, subject) {
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new Error(`corrupt session log: ${subject} is not valid JSON`, { cause: error });
	}
}
/** Incremental JSONL parser that retains only one cross-frame record fragment. */
var MigratingJsonlRows = class {
	restore;
	fragments = [];
	fragmentBytes = 0;
	rowIndex = 0;
	issue;
	constructor(restore) {
		this.restore = restore;
	}
	/** Consume plaintext bytes following the independently decoded header. */
	write(chunk) {
		let lineStart = 0;
		for (let newline = chunk.indexOf(10); newline !== -1; newline = chunk.indexOf(10, lineStart)) {
			const fragment = chunk.subarray(lineStart, newline);
			let line = fragment;
			if (this.fragments.length > 0) {
				if (fragment.length > 0) this.fragments.push(fragment);
				line = Buffer.concat(this.fragments, this.fragmentBytes + fragment.length);
				this.fragments = [];
				this.fragmentBytes = 0;
			}
			this.consume(line);
			lineStart = newline + 1;
		}
		if (lineStart < chunk.length) {
			const fragment = Buffer.from(chunk.subarray(lineStart));
			this.fragments.push(fragment);
			this.fragmentBytes += fragment.length;
		}
	}
	/** Refuse a record fragment left by structurally complete Zstandard frames. */
	assertCompleteFramesEndOnRecord() {
		if (this.fragments.length > 0) throw new Error("corrupt Zstandard session log: complete frame contains a torn JSONL record");
	}
	finish() {
		return this.restore.finish();
	}
	consume(line) {
		const index = this.rowIndex;
		this.rowIndex += 1;
		let row;
		try {
			row = parseJson(line.toString("utf8"), `row ${index + 1}`);
		} catch (error) {
			this.issue ??= asError(error);
			return;
		}
		if (this.issue !== void 0) {
			if (typeof row === "object" && row !== null && row.type === "turn/end") throw this.issue;
			return;
		}
		this.restore.decodeRow(row);
	}
};
async function startMigrationStream(headerRecord, sourceVersion, format, validateHistoricalHeader) {
	const value = parseJson(headerRecord.subarray(0, -1).toString("utf8"), "header line");
	const version = storedVersion(value);
	if (version !== sourceVersion) throw new Error(`resolved JSONL source filename identifies v${sourceVersion}, but its header identifies v${version}`);
	const header = value;
	const validation = validateHistoricalHeader?.(header);
	if (validation !== void 0) await validation;
	return { parser: new MigratingJsonlRows(format.createRestore(header)) };
}
async function consumeMigrationBytes(rows, chunks, signal) {
	signal?.throwIfAborted();
	let yieldDeadline = performance.now() + MIGRATION_DECODE_YIELD_INTERVAL_MS;
	for (const bytes of chunks) for (let offset = 0; offset < bytes.length; offset += MIGRATION_WORK_CHUNK_BYTES) {
		rows.write(bytes.subarray(offset, offset + MIGRATION_WORK_CHUNK_BYTES));
		if (performance.now() < yieldDeadline) continue;
		await scheduler.yield();
		signal?.throwIfAborted();
		yieldDeadline = performance.now() + MIGRATION_DECODE_YIELD_INTERVAL_MS;
	}
}
async function decodeStreamingMigration(bytes, compression, sourceVersion, format, validateHistoricalHeader, signal) {
	signal?.throwIfAborted();
	if (compression === "none") {
		const headerEnd = bytes.indexOf(10);
		if (headerEnd === -1) throw new Error("empty or header-less session log");
		const stream = await startMigrationStream(bytes.subarray(0, headerEnd + 1), sourceVersion, format, validateHistoricalHeader);
		signal?.throwIfAborted();
		const bodyEnd = bytes.lastIndexOf(10);
		if (bodyEnd > headerEnd) await consumeMigrationBytes(stream.parser, [bytes.subarray(headerEnd + 1, bodyEnd + 1)], signal);
		return stream.parser.finish();
	}
	const { frames, tornStart } = scanZstdFrames(bytes);
	if (frames.length === 0) throw new Error("empty or header-less Zstandard session log");
	const decoder = createZstdFrameDecoder();
	try {
		const decoded = decoder.decode(bytes, frames);
		const first = decoded.next();
		/* v8 ignore next -- a non-empty structural frame list yields once or throws. */
		if (first.done) throw new Error("empty or header-less Zstandard session log");
		assertIndependentHeaderFrame(first.value);
		const stream = await startMigrationStream(first.value, sourceVersion, format, validateHistoricalHeader);
		signal?.throwIfAborted();
		await consumeMigrationBytes(stream.parser, decoded, signal);
		stream.parser.assertCompleteFramesEndOnRecord();
		if (tornStart !== void 0) {
			let recovered = Buffer.alloc(0);
			try {
				recovered = await decompressZstdPrefix(bytes.subarray(tornStart));
			} catch {
				/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent. */
				if (signal?.aborted) signal.throwIfAborted();
			}
			signal?.throwIfAborted();
			const newline = recovered.lastIndexOf(10);
			if (newline !== -1) await consumeMigrationBytes(stream.parser, [recovered.subarray(0, newline + 1)], signal);
		}
		return stream.parser.finish();
	} finally {
		decoder.close();
	}
}
/**
* Read and validate one complete current generation for an isolated verifier.
* @param path - staged or competing current-generation path.
* @param compression - configured physical encoding.
* @param expectedId - Session identity expected in the header.
* @param expectedEventCount - exact logical event count expected after decoding.
* @param expectedPrefix - verified migration prefix; an append tail may be present and is not validated.
* @returns stable physical identity and digest for publication comparison.
*/
async function verifyJsonlCurrentGeneration(path, compression, expectedId, expectedEventCount, expectedPrefix) {
	return defaultGenerationRuntime.verify(path, compression, expectedId, expectedEventCount, expectedPrefix);
}
async function verifyCurrentGeneration(path, compression, expectedId, expectedEventCount, fs, expectedPrefix) {
	const before = await fs.stat(path);
	const bytes = await fs.readFile(path);
	const after = await fs.stat(path);
	if (expectedPrefix !== void 0) {
		if (bytes.length < expectedPrefix.bytes) throw new Error("target bytes are shorter than the migrated generation");
		const digest = createHash("sha256").update(bytes.subarray(0, expectedPrefix.bytes)).digest("hex");
		if (digest !== expectedPrefix.digest) throw new Error("target bytes do not begin with the migrated generation");
		return {
			identity: after,
			bytes: expectedPrefix.bytes,
			digest
		};
	}
	if (identity(before) !== identity(after)) throw new Error("current session generation changed during verification");
	const snapshot = {
		bytes,
		identity: after
	};
	const generation = decodeCurrentGeneration(snapshot.bytes, compression);
	validateStoredEvents(generation.meta, generation.events, {
		kind: "jsonl",
		path
	});
	if (generation.meta.id !== expectedId) throw new Error(`current session generation contains id "${generation.meta.id}", expected "${expectedId}"`);
	if (generation.events.length !== expectedEventCount) throw new Error(`current session generation contains ${generation.events.length} events, expected ${expectedEventCount}`);
	Session.fromRestore(generation.meta.id, generation.events, generation.meta, generation.inheritedEventCount, "detached");
	assertCurrentAssistantStreams(generation.events);
	return {
		identity: snapshot.identity,
		bytes: snapshot.bytes.length,
		digest: createHash("sha256").update(snapshot.bytes).digest("hex")
	};
}
/**
* Read one complete current-format generation for maintenance tooling.
* Unlike the normal persistence read path this returns the validated artifact
* so a copied data root can be audited before any successor is published.
* @param path - current v3 generation path.
* @param compression - physical encoding selected for the data root.
* @returns the decoded current artifact and its stable source identity/digest.
*/
async function readCurrentJsonlGeneration(path, compression) {
	const source = await readStableJsonlFile(path);
	const decoded = decodeCurrentGeneration(source.bytes, compression);
	validateStoredEvents(decoded.meta, decoded.events, {
		kind: "jsonl",
		path
	});
	Session.fromRestore(decoded.meta.id, decoded.events, decoded.meta, decoded.inheritedEventCount, "detached");
	assertCurrentAssistantStreams(decoded.events);
	return {
		...decoded,
		identity: source.identity,
		digest: createHash("sha256").update(source.bytes).digest("hex")
	};
}
/** Fully replay embedded streams only inside isolated current-generation verification. */
function assertCurrentAssistantStreams(events) {
	for (const [index, event] of events.entries()) {
		if (event.type !== "assistant/message" && event.type !== "assistant/attempt") continue;
		const assembler = new BlockAssembler();
		let timed;
		try {
			timed = expandAssistantStream(event.data.stream);
			for (const member of timed) assembler.push(member.chunk);
		} catch (error) {
			throw new Error(`seed ${event.type} at index ${index} has an invalid embedded stream`, { cause: error });
		}
		if (event.type === "assistant/attempt" || timed.length === 0) continue;
		const content = event.data.interrupted === true ? assembler.interruptedBlocks() : assembler.blocks();
		if (!isDeepStrictEqual(event.data.message.content, content)) throw new Error(`seed assistant/message at index ${index} content disagrees with its embedded stream`);
		if (!isDeepStrictEqual(event.data.usage, assembler.usage)) throw new Error(`seed assistant/message at index ${index} usage disagrees with its embedded stream`);
		if (!isDeepStrictEqual(event.data.message.source.replayState, assembler.replayState)) throw new Error(`seed assistant/message at index ${index} replay state disagrees with its embedded stream`);
	}
}
function decodeCurrentGeneration(bytes, compression) {
	if (compression === "none") {
		const headerEnd = bytes.indexOf(10);
		if (headerEnd === -1) throw new Error("empty or header-less session log");
		const scanner = new SessionLogScanner(bytes.subarray(0, headerEnd + 1), "strict");
		scanner.write(bytes.subarray(headerEnd + 1));
		return finishCurrentGenerationScan(scanner);
	}
	const { frames, tornStart } = scanZstdFrames(bytes);
	if (frames.length === 0) throw new Error("empty or header-less Zstandard session log");
	if (tornStart !== void 0) throw new Error("current session generation has a torn physical tail");
	const decoder = createZstdFrameDecoder();
	try {
		const plaintext = decoder.decode(bytes, frames);
		const header = plaintext.next();
		/* v8 ignore next -- a non-empty structural frame list yields once or throws. */
		if (header.done) throw new Error("empty or header-less Zstandard session log");
		assertIndependentHeaderFrame(header.value);
		const scanner = new SessionLogScanner(header.value, "strict");
		for (const chunk of plaintext) scanner.write(chunk);
		return finishCurrentGenerationScan(scanner);
	} finally {
		decoder.close();
	}
}
function finishCurrentGenerationScan(scanner) {
	const inputBytes = scanner.checkpoint().inputBytes;
	const decoded = scanner.finish();
	if (decoded.committedBytes !== inputBytes) throw new Error("current session generation has a torn physical tail");
	return decoded;
}
function stringifyJson(value, subject) {
	let text;
	try {
		text = JSON.stringify(value);
	} catch (error) {
		throw new Error(`${subject} is not lossless JSON`, { cause: error });
	}
	if (typeof text !== "string") throw new Error(`${subject} is not lossless JSON`);
	return text;
}
function assertIndependentHeaderFrame(plaintext) {
	if (plaintext.length === 0 || plaintext.indexOf(10) !== plaintext.length - 1) throw new Error("corrupt Zstandard session log: first frame is not exactly one header line");
}
function assertGenerationPaths(sourcePath, sourceVersion, currentPath, currentVersion, compression) {
	const expectedSource = generationLogFilename(sourceVersion, compression);
	const expectedCurrent = generationLogFilename(currentVersion, compression);
	if (basename(sourcePath) !== expectedSource) throw new Error(`resolved JSONL source path must end with "${expectedSource}": ${sourcePath}`);
	if (basename(currentPath) !== expectedCurrent) throw new Error(`current JSONL generation path must end with "${expectedCurrent}": ${currentPath}`);
	if (dirname(sourcePath) !== dirname(currentPath)) throw new Error("source and current JSONL generations must share one Session directory");
	return logSuffix(compression);
}
async function syncDirectory(path, internals) {
	/* v8 ignore next -- Windows namespace operations request write-through directly. */
	if (internals.platform === "win32") return;
	const handle = await internals.fs.open(path, "r");
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
/** Produce bounded JSONL chunks while yielding between main-thread encoding slices. */
async function* encodeMigrationRows(artifact, format, signal) {
	signal?.throwIfAborted();
	let lines = [];
	let bytes = 0;
	for (const value of artifact.events) {
		const line = `${stringifyJson(format.encodeEvent(value), `migrated Session event ${value.seq}`)}\n`;
		const lineBytes = Buffer.byteLength(line);
		if (bytes > 0 && bytes + lineBytes > MIGRATION_WORK_CHUNK_BYTES) {
			yield Buffer.from(lines.join(""));
			await scheduler.yield();
			signal?.throwIfAborted();
			lines = [];
			bytes = 0;
		}
		lines.push(line);
		bytes += lineBytes;
	}
	yield Buffer.from(lines.join(""));
}
async function writeMigrationChunks(chunks, write) {
	let pending = [];
	let bytes = 0;
	for await (const chunk of chunks) {
		pending.push(chunk);
		bytes += chunk.length;
		if (bytes < MIGRATION_WRITE_CHUNK_BYTES) continue;
		await write(pending.length === 1 ? pending[0] : Buffer.concat(pending, bytes));
		pending = [];
		bytes = 0;
	}
	if (bytes > 0) await write(pending.length === 1 ? pending[0] : Buffer.concat(pending, bytes));
}
/** Encode directly into one synced stage without a whole-artifact row or byte buffer. */
async function writeSyncedTemp(currentPath, suffix, compression, artifact, format, signal, internals) {
	signal?.throwIfAborted();
	let path;
	let handle;
	for (;;) {
		path = join(dirname(currentPath), `session.migration.${internals.randomToken()}${suffix}.tmp`);
		try {
			handle = await internals.fs.open(path, "wx", 384);
			break;
		} catch (error) {
			if (isEEXIST(error)) continue;
			throw error;
		}
	}
	const hash = createHash("sha256");
	let bytes = 0;
	const write = async (chunk) => {
		await handle.writeFile(chunk);
		hash.update(chunk);
		bytes += chunk.length;
	};
	let failure;
	try {
		const headerValue = format.encodeHeader(artifact.header, artifact.inheritedEventCount);
		const header = Buffer.from(`${stringifyJson(headerValue, "migrated session header")}\n`);
		await write(compression === "zstd" ? await compressZstdFrame(header) : header);
		if (artifact.events.length > 0) {
			const rows = encodeMigrationRows(artifact, format, signal);
			if (compression === "none") await writeMigrationChunks(rows, write);
			else await new Promise((resolve, reject) => {
				pipeline(Readable.from(rows, {
					objectMode: false,
					highWaterMark: MIGRATION_WORK_CHUNK_BYTES
				}), createZstdCompress(ZSTD_CHECKSUM_OPTIONS), async (source) => {
					await writeMigrationChunks(source, write);
				}, (error) => {
					if (error instanceof Error) reject(error);
					else resolve();
				});
			});
		}
		signal?.throwIfAborted();
		await handle.sync();
	} catch (error) {
		failure = error;
	}
	try {
		await handle.close();
	} catch (error) {
		failure = failure === void 0 ? error : new AggregateError([failure, error], `failed to write and close migration stage "${path}"`);
	}
	if (failure !== void 0) {
		const writeError = failure instanceof Error ? failure : new Error("migration stage write failed with a non-Error rejection", { cause: failure });
		await removeTemporary(path, writeError, internals);
		throw writeError;
	}
	return {
		path,
		bytes,
		digest: hash.digest("hex")
	};
}
/** Remove one temporary file without hiding the operation failure that made it disposable. */
async function removeTemporary(path, primaryFailure, internals) {
	try {
		await internals.fs.rm(path);
	} catch (cleanupFailure) {
		throw new AggregateError([primaryFailure, cleanupFailure], `failed to clean migration temporary "${path}" after an earlier failure`);
	}
}
/** Remove a redundant stage after the target has been validated as committed. */
async function removeCommittedTemporary(path, internals) {
	try {
		await internals.fs.rm(path);
	} catch {}
}
async function publishCurrentExclusive(staged, currentPath, internals) {
	if (internals.platform === "win32") try {
		await internals.publishNewWin32(staged, currentPath);
		return true;
	} catch (error) {
		/* v8 ignore else -- native helper tests own non-collision Win32 failures. */
		if (isEEXIST(error)) return false;
		/* v8 ignore next -- the filesystem error is already complete. */
		throw error;
	}
	try {
		await internals.fs.link(staged, currentPath);
	} catch (error) {
		/* v8 ignore else -- a non-collision filesystem error propagates unchanged. */
		if (isEEXIST(error)) return false;
		/* v8 ignore next -- the filesystem error is already complete. */
		throw error;
	}
	await syncDirectory(dirname(currentPath), internals);
	return true;
}
function asError(error) {
	return error instanceof Error ? error : new Error("current-generation validation failed with a non-Error rejection", { cause: error });
}
async function inspectExpectedCurrent(currentPath, internals, inspect) {
	try {
		const expectedName = basename(currentPath);
		const names = await internals.fs.readdir(dirname(currentPath));
		if (!names.includes(expectedName)) {
			const noncanonical = names.find((name) => name.toLowerCase() === expectedName.toLowerCase());
			if (noncanonical !== void 0) throw new Error(`target resolves to noncanonical directory entry "${noncanonical}"`);
		}
		const info = await internals.fs.lstat(currentPath);
		if (info.isSymbolicLink() || !info.isFile()) throw new Error(`target is a ${info.isSymbolicLink() ? "symbolic link" : "non-regular file"}`);
		return await inspect();
	} catch (error) {
		if (isErrnoException(error)) throw error;
		throw new JsonlGenerationTargetConflictError(currentPath, asError(error));
	}
}
function withOverrides(overrides) {
	return {
		...defaultInternals,
		...overrides,
		fs: {
			...defaultFileSystem,
			...overrides.fs
		}
	};
}
async function publishPreparedMigration(options, suffix, artifact, sourceIdentity, internals) {
	await scheduler.yield();
	const { sourcePath, currentPath, compression, verifyCurrentFile } = options;
	const eventCount = artifact.events.length;
	let staged = await writeSyncedTemp(currentPath, suffix, compression, artifact, options.format, void 0, internals);
	try {
		const verifiedStage = await verifyCurrentFile(staged.path, compression, artifact.header.id, eventCount);
		if (verifiedStage.bytes !== staged.bytes || verifiedStage.digest !== staged.digest) throw new Error("staged session generation changed during verification");
		await internals.barrier("before-source-check", 1);
		if (identity(await internals.fs.stat(sourcePath)) !== identity(sourceIdentity)) throw new JsonlGenerationSourceChangedError(sourcePath);
		const published = await publishCurrentExclusive(staged.path, currentPath, internals);
		if (published && internals.platform === "win32") staged = {
			...staged,
			path: ""
		};
		await internals.barrier("after-publication", 1);
		let currentIdentity;
		if (published) {
			if (staged.path !== "") {
				await removeCommittedTemporary(staged.path, internals);
				staged = {
					...staged,
					path: ""
				};
			}
			currentIdentity = await internals.fs.stat(currentPath);
		} else {
			currentIdentity = (await inspectExpectedCurrent(currentPath, internals, async () => {
				const candidate = await verifyCurrentFile(currentPath, compression, artifact.header.id, eventCount, staged);
				if (candidate.bytes !== staged.bytes || candidate.digest !== staged.digest) throw new Error("target bytes differ from the migrated generation");
				return candidate;
			})).identity;
			await removeCommittedTemporary(staged.path, internals);
			staged = {
				...staged,
				path: ""
			};
		}
		return currentIdentity;
	} catch (error) {
		if (staged.path !== "") await removeTemporary(staged.path, error, internals);
		throw error;
	}
}
async function prepareMigration(options, internals) {
	const { sourcePath, sourceVersion, currentPath, compression, format, signal } = options;
	const suffix = assertGenerationPaths(sourcePath, sourceVersion, currentPath, format.currentVersion, compression);
	if (sourceVersion >= format.currentVersion) throw new Error(`migration preparation requires a historical source, got v${sourceVersion}`);
	const source = await readStableSnapshot(sourcePath, signal, internals.fs);
	let artifact;
	try {
		artifact = await decodeStreamingMigration(source.bytes, compression, sourceVersion, format, options.validateHistoricalHeader, signal);
	} catch (error) {
		if (format.isUnsupportedMigrationError?.(error) === true) throw new JsonlGenerationUnsupportedMigrationError(sourceVersion, error);
		throw error;
	}
	if (artifact.header.version !== format.currentVersion) throw new Error(`format migration returned v${artifact.header.version}, expected v${format.currentVersion}`);
	const sourceIdentity = source.identity;
	let publication;
	return {
		sourceIdentity,
		artifact,
		publish() {
			if (publication === void 0) publication = publishPreparedMigration(options, suffix, artifact, sourceIdentity, internals);
			return publication;
		}
	};
}
/**
* Decode and migrate one historical generation without writing its successor.
* @param options - resolved source, current target, format adapter, and load cancellation.
* @returns the current artifact and an idempotent explicit publication operation.
*/
function prepareJsonlMigration(options) {
	return defaultGenerationRuntime.prepare(options);
}
/**
* Create one generation runtime with fixed filesystem and publication dependencies.
* @param overrides - deterministic filesystem, platform, and race dependencies.
* @returns bound generation operations.
*/
function createJsonlGenerationRuntime(overrides = {}) {
	const internals = withOverrides(overrides);
	return {
		readStable: (path, signal) => readStableSnapshot(path, signal, internals.fs),
		prepare: (options) => prepareMigration(options, internals),
		verify: (path, compression, expectedId, expectedEventCount, expectedPrefix) => verifyCurrentGeneration(path, compression, expectedId, expectedEventCount, internals.fs, expectedPrefix)
	};
}
const defaultGenerationRuntime = createJsonlGenerationRuntime();
//#endregion
export { sessionDir as C, ensureDurableDirectoryWin32 as D, SessionWriteLease as E, publishNewFileWin32 as O, scanLog as S, LEASE_FILENAME as T, generationLogPath as _, readStableJsonlFile as a, parseGenerationLogFilename as b, createZstdFrameDecoder as c, scanZstdFrames as d, SessionLogScanner as f, generationLogFilename as g, eventLines as h, readCurrentJsonlGeneration as i, decompressZstdFrame as l, encodeSegment as m, JsonlGenerationUnsupportedMigrationError as n, verifyJsonlCurrentGeneration as o, assertNoRetiredHeaderFields as p, prepareJsonlMigration as r, compressZstdFrame as s, JsonlGenerationSourceChangedError as t, decompressZstdPrefix as u, logPath as v, toHeaderLine as w, projectDir as x, logSuffix as y };
