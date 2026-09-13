import { C as sessionDir, _ as generationLogPath, a as readStableJsonlFile, b as parseGenerationLogFilename, d as scanZstdFrames, g as generationLogFilename, i as readCurrentJsonlGeneration, l as decompressZstdFrame, o as verifyJsonlCurrentGeneration, r as prepareJsonlMigration } from "./generation-BkeoNAc_.js";
import { SessionFormatUnsupportedMigrationError, sessionFormatCatalog } from "@deepseek-ai/dsh-session-format-catalog";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
//#region src/migration.ts
/**
* Fail-closed maintenance tooling for a SOC JSONL session root.
*
* This module deliberately lives beside the SOC persistence fork so the
* migration command uses the same released format catalog, physical framing,
* ownership-independent path rules, and immutable successor publisher as the
* running backend. It never edits the upstream vendor snapshot.
*
* @module dsh-soc-agent-session-persistence-jsonl/migration
*/
const execFileAsync = promisify(execFile);
const BACKUP_MANIFEST = "session-root-backup.json";
const MIGRATION_MANIFEST = "session-root-migration.json";
const generationFormat = {
	currentVersion: sessionFormatCatalog.currentVersion,
	createRestore: (header) => sessionFormatCatalog.createRestore(header, {
		recovery: "strict",
		validation: "current"
	}),
	encodeHeader: (header, inheritedEventCount) => sessionFormatCatalog.encodeCurrentHeader(header, inheritedEventCount),
	encodeEvent: (event) => sessionFormatCatalog.encodeCurrentEvent(event),
	isUnsupportedMigrationError: (error) => error instanceof SessionFormatUnsupportedMigrationError
};
function asError(error) {
	return error instanceof Error ? error : new Error(String(error));
}
function digest(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}
function identityKey(value) {
	return [
		value.dev,
		value.ino,
		value.size,
		value.mtimeNs,
		value.ctimeNs
	].join(":");
}
function pathInside(root, candidate) {
	const remainder = relative(resolve(root), resolve(candidate));
	return remainder === "" || remainder !== ".." && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder);
}
function relativeFilePath(root, path) {
	return relative(root, path).split(sep).join("/");
}
async function assertDirectory(path, subject) {
	let info;
	try {
		info = await lstat(path);
	} catch (error) {
		throw new Error(`${subject} is not available: ${path}`, { cause: error });
	}
	if (info.isSymbolicLink()) throw new Error(`${subject} must not be a symbolic link: ${path}`);
	if (!info.isDirectory()) throw new Error(`${subject} must be a directory: ${path}`);
}
async function assertRegularFile(path, subject) {
	let info;
	try {
		info = await lstat(path);
	} catch (error) {
		throw new Error(`${subject} is not available: ${path}`, { cause: error });
	}
	if (info.isSymbolicLink()) throw new Error(`${subject} must not be a symbolic link: ${path}`);
	if (!info.isFile()) throw new Error(`${subject} must be a regular file: ${path}`);
}
function summaryOf(storedVersion, header) {
	return {
		storedVersion,
		version: header.version,
		id: String(header.id),
		createdAt: header.createdAt,
		cwd: header.cwd === void 0 ? null : String(header.cwd),
		parentSession: header.parentSession === void 0 ? null : String(header.parentSession),
		isSeeded: header.isSeeded,
		origin: header.origin === void 0 ? null : header.origin,
		delegationDepth: header.delegationDepth,
		agentPreset: header.agentPreset === void 0 ? null : String(header.agentPreset)
	};
}
function headerFromResult(value, expectedVersion, path) {
	const result = sessionFormatCatalog.readHeader(value);
	if (result.status === "malformed") throw new Error(`corrupt session header in ${path}: ${result.reason}`);
	if (result.status === "unsupported") throw new Error(`unsupported session format in ${path}: ${result.reason}`);
	if (result.storedVersion !== expectedVersion) throw new Error(`session generation filename identifies v${expectedVersion}, but its header identifies v${result.storedVersion}: ${path}`);
	return result.header;
}
function headerRecordFromBytes(bytes, compression, path) {
	if (compression === "none") {
		const end = bytes.indexOf(10);
		if (end === -1) throw new Error(`corrupt session log has no complete header line: ${path}`);
		return bytes.subarray(0, end + 1);
	}
	const first = scanZstdFrames(bytes, 1).frames[0];
	if (first === void 0) throw new Error(`corrupt Zstandard session log has no header frame: ${path}`);
	return bytes.subarray(first.start, first.end);
}
async function readRawHeader(bytes, compression, path) {
	if (compression === "none") {
		const record = headerRecordFromBytes(bytes, compression, path);
		try {
			return JSON.parse(record.subarray(0, -1).toString("utf8"));
		} catch (error) {
			throw new Error(`corrupt session header is not valid JSON: ${path}`, { cause: error });
		}
	}
	const frame = headerRecordFromBytes(bytes, compression, path);
	let plaintext;
	try {
		plaintext = await decompressZstdFrame(frame);
	} catch (error) {
		throw new Error(`corrupt Zstandard session header frame: ${path}`, { cause: error });
	}
	if (plaintext.length === 0 || plaintext.at(-1) !== 10 || plaintext.indexOf(10) !== plaintext.length - 1) throw new Error(`corrupt Zstandard session header frame is not one JSONL record: ${path}`);
	try {
		return JSON.parse(plaintext.subarray(0, -1).toString("utf8"));
	} catch (error) {
		throw new Error(`corrupt session header is not valid JSON: ${path}`, { cause: error });
	}
}
/** Reject all physical damage before the format catalog is allowed to recover anything. */
async function assertCompletePhysicalLog(bytes, compression, path) {
	if (bytes.length === 0) throw new Error(`empty session log: ${path}`);
	if (compression === "none") {
		if (bytes.at(-1) !== 10) throw new Error(`session log has a torn plaintext tail: ${path}`);
		headerRecordFromBytes(bytes, compression, path);
		return;
	}
	const scan = scanZstdFrames(bytes);
	if (scan.frames.length === 0) throw new Error(`empty Zstandard session log: ${path}`);
	if (scan.tornStart !== void 0) throw new Error(`session log has a torn Zstandard tail at byte ${scan.tornStart}: ${path}`);
	for (const [index, frame] of scan.frames.entries()) try {
		const plaintext = await decompressZstdFrame(bytes.subarray(frame.start, frame.end));
		if (index === 0 && (plaintext.length === 0 || plaintext.at(-1) !== 10 || plaintext.indexOf(10) !== plaintext.length - 1)) throw new Error("header frame is not exactly one newline-terminated record");
	} catch (error) {
		throw new Error(`corrupt Zstandard frame ${index} in ${path}`, { cause: error });
	}
}
function assertGenerationIdentity(root, path, storedVersion, header, compression) {
	const expected = resolve(generationLogPath(root, header.cwd, String(header.id), storedVersion, compression));
	if (resolve(path) !== expected) throw new Error(`session header id/cwd does not identify its physical path: ${path}; expected ${expected}`);
	const expectedDirectory = resolve(sessionDir(root, header.cwd, String(header.id)));
	if (resolve(dirname(path)) !== expectedDirectory) throw new Error(`session directory does not match header identity: ${path}`);
}
async function assertUnchanged(path, identity, sha256) {
	const after = await readStableJsonlFile(path);
	const afterDigest = digest(after.bytes);
	if (identityKey(after.identity) !== identityKey(identity) || afterDigest !== sha256) throw new Error(`session generation changed during maintenance validation: ${path}`);
}
async function auditGeneration(root, path, storedVersion, selected, compression) {
	const currentVersion = sessionFormatCatalog.currentVersion;
	if (storedVersion > currentVersion) throw new Error(`session generation v${storedVersion} is newer than installed v${currentVersion}: ${path}`);
	const source = await readStableJsonlFile(path);
	const sourceDigest = digest(source.bytes);
	await assertCompletePhysicalLog(source.bytes, compression, path);
	const currentPath = join(dirname(path), generationLogFilename(currentVersion, compression));
	if (storedVersion === currentVersion) {
		const current = await readCurrentJsonlGeneration(path, compression);
		if (identityKey(current.identity) !== identityKey(source.identity) || current.digest !== sourceDigest) throw new Error(`current session generation changed during audit: ${path}`);
		const header = current.meta;
		assertGenerationIdentity(root, path, storedVersion, header, compression);
		return {
			path,
			currentPath,
			storedVersion,
			selected,
			header: summaryOf(storedVersion, header),
			eventCount: current.events.length,
			inheritedEventCount: Number(current.inheritedEventCount),
			bytes: source.bytes.length,
			sha256: sourceDigest,
			identity: source.identity
		};
	}
	assertGenerationIdentity(root, path, storedVersion, headerFromResult(await readRawHeader(source.bytes, compression, path), storedVersion, path), compression);
	let prepared;
	try {
		prepared = await prepareJsonlMigration({
			sourcePath: path,
			sourceVersion: storedVersion,
			currentPath,
			compression,
			format: generationFormat,
			verifyCurrentFile: verifyJsonlCurrentGeneration,
			validateHistoricalHeader: (headerValue) => {
				assertGenerationIdentity(root, path, storedVersion, headerFromResult(headerValue, storedVersion, path), compression);
			}
		});
	} catch (error) {
		throw new Error(`historical session generation failed validation: ${path}`, { cause: error });
	}
	const artifact = prepared.artifact;
	const logicalHeader = artifact.header;
	assertGenerationIdentity(root, path, storedVersion, logicalHeader, compression);
	await assertUnchanged(path, source.identity, sourceDigest);
	return {
		path,
		currentPath,
		storedVersion,
		selected,
		header: summaryOf(storedVersion, logicalHeader),
		eventCount: artifact.events.length,
		inheritedEventCount: artifact.inheritedEventCount,
		bytes: source.bytes.length,
		sha256: sourceDigest,
		identity: source.identity,
		...selected ? { prepared } : {}
	};
}
async function auditSession(root, directory, generationPaths, compression) {
	const selectedVersion = generationPaths.at(-1)?.version;
	if (selectedVersion === void 0) throw new Error(`session directory has no generation: ${directory}`);
	const generations = [];
	for (const generation of generationPaths) generations.push(await auditGeneration(root, generation.path, generation.version, generation.version === selectedVersion, compression));
	const first = generations[0];
	for (const generation of generations.slice(1)) if (generation.header.id !== first.header.id || generation.header.cwd !== first.header.cwd) throw new Error(`generations in one session directory disagree on id/cwd: ${directory}`);
	return {
		directory,
		id: first.header.id,
		cwd: first.header.cwd,
		selectedVersion,
		generations
	};
}
async function listRootFiles(root) {
	const files = [];
	async function visit(directory) {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			const path = join(directory, entry.name);
			const info = await lstat(path);
			if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`);
			if (info.isDirectory()) {
				await visit(path);
				continue;
			}
			if (!info.isFile()) throw new Error(`session root contains a non-regular entry: ${path}`);
			const before = await stat(path, { bigint: true });
			const bytes = await readFile(path);
			const after = await stat(path, { bigint: true });
			if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error(`session root file changed while being fingerprinted: ${path}`);
			files.push({
				path,
				bytes: bytes.length,
				sha256: digest(bytes)
			});
		}
	}
	await visit(root);
	return files.sort((left, right) => left.path.localeCompare(right.path));
}
function publicFiles(root, files) {
	return files.map((file) => ({
		path: relativeFilePath(root, file.path),
		bytes: file.bytes,
		sha256: file.sha256
	}));
}
async function readOwnershipManifest(value) {
	if (typeof value !== "string") return value;
	let parsed;
	try {
		parsed = JSON.parse(await readFile(value, "utf8"));
	} catch (error) {
		throw new Error(`ownership manifest is not valid JSON: ${value}`, { cause: error });
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("ownership manifest must be a JSON object");
	return parsed;
}
function recordArray(value, subject, idKey) {
	if (Array.isArray(value)) return value.map((item, index) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`${subject}[${index}] must be an object`);
		return item;
	});
	if (value !== null && typeof value === "object") return Object.entries(value).map(([id, item]) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error(`${subject}[${JSON.stringify(id)}] must be an object`);
		const record = item;
		return {
			...record,
			[idKey]: record[idKey] ?? id
		};
	});
	throw new Error(`${subject} must be an array or object map`);
}
function requiredString(value, subject) {
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${subject} must be a non-empty string`);
	return value;
}
function normalizeOwnership(value) {
	const source = value;
	const sessionRows = recordArray(source.sessions ?? source.sessionOwners, "ownership.sessions", "id");
	const workspaceRows = recordArray(source.workspaces ?? source.workspaceOwners, "ownership.workspaces", "id");
	const sessions = [];
	const workspaces = [];
	const sessionIds = /* @__PURE__ */ new Set();
	const workspaceIds = /* @__PURE__ */ new Set();
	for (const [index, row] of sessionRows.entries()) {
		const id = requiredString(row.id, `ownership.sessions[${index}].id`);
		if (sessionIds.has(id)) throw new Error(`ownership manifest repeats session ${JSON.stringify(id)}`);
		sessionIds.add(id);
		const cwd = row.cwd === void 0 ? void 0 : requiredString(row.cwd, `ownership.sessions[${index}].cwd`);
		sessions.push({
			id,
			userId: requiredString(row.userId, `ownership.sessions[${index}].userId`),
			workspaceId: requiredString(row.workspaceId, `ownership.sessions[${index}].workspaceId`),
			...cwd === void 0 ? {} : { cwd }
		});
	}
	for (const [index, row] of workspaceRows.entries()) {
		const id = requiredString(row.id, `ownership.workspaces[${index}].id`);
		if (workspaceIds.has(id)) throw new Error(`ownership manifest repeats workspace ${JSON.stringify(id)}`);
		workspaceIds.add(id);
		const path = requiredString(row.path, `ownership.workspaces[${index}].path`);
		if (!isAbsolute(path)) throw new Error(`ownership.workspaces[${index}].path must be absolute`);
		workspaces.push({
			id,
			userId: requiredString(row.userId, `ownership.workspaces[${index}].userId`),
			path: resolve(path),
			...row.title === void 0 ? {} : { title: requiredString(row.title, `ownership.workspaces[${index}].title`) },
			...row.general === true ? { general: true } : {}
		});
	}
	return {
		sessions,
		workspaces
	};
}
function isGeneralWorkspace(workspace) {
	return workspace.general === true || workspace.title?.toLowerCase() === "general" || basename(workspace.path).toLowerCase() === "general";
}
function validateOwnership(audit, manifest) {
	const normalized = normalizeOwnership(manifest);
	const sessions = new Map(normalized.sessions.map((entry) => [entry.id, entry]));
	const workspaces = new Map(normalized.workspaces.map((entry) => [entry.id, entry]));
	const discovered = new Set(audit.map((session) => session.id));
	for (const session of normalized.sessions) if (!discovered.has(session.id)) throw new Error(`ownership manifest contains an unknown session ${JSON.stringify(session.id)}`);
	for (const session of audit) {
		const owner = sessions.get(session.id);
		if (owner === void 0) throw new Error(`ownership manifest has no owner for session ${JSON.stringify(session.id)}`);
		const selected = session.generations.find((generation) => generation.selected);
		if (owner.cwd !== void 0 && owner.cwd !== selected.header.cwd) throw new Error(`ownership cwd disagrees with session header ${JSON.stringify(session.id)}`);
		const workspace = workspaces.get(owner.workspaceId);
		if (workspace === void 0) throw new Error(`ownership manifest has no workspace ${JSON.stringify(owner.workspaceId)} for session ${JSON.stringify(session.id)}`);
		if (workspace.userId !== owner.userId) throw new Error(`session/workspace ownership disagrees for ${JSON.stringify(session.id)}`);
		if (selected.header.cwd === null) {
			if (!isGeneralWorkspace(workspace)) throw new Error(`session ${JSON.stringify(session.id)} has no cwd but is not in General`);
		} else if (resolve(selected.header.cwd) !== resolve(workspace.path)) throw new Error(`session/workspace path disagrees for ${JSON.stringify(session.id)}`);
	}
}
function toPublicAudit(root) {
	return {
		root: root.root,
		compression: root.compression,
		currentVersion: root.currentVersion,
		sessions: root.sessions.map((session) => ({
			directory: session.directory,
			id: session.id,
			cwd: session.cwd,
			selectedVersion: session.selectedVersion,
			generations: session.generations.map((generation) => ({
				path: generation.path,
				currentPath: generation.currentPath,
				storedVersion: generation.storedVersion,
				selected: generation.selected,
				header: generation.header,
				eventCount: generation.eventCount,
				inheritedEventCount: generation.inheritedEventCount,
				bytes: generation.bytes,
				sha256: generation.sha256
			}))
		})),
		files: root.files
	};
}
/**
* Audit every project/session/generation in a copied or maintenance root.
* No recovery or truncation is allowed: torn, unknown, unsupported, or
* structurally unexpected data rejects the complete audit.
*/
async function auditSessionRoot(options) {
	const root = resolve(options.root);
	const compression = options.compression;
	if (compression !== "none" && compression !== "zstd") throw new Error(`unsupported JSONL compression: ${compression}`);
	await assertDirectory(root, "session root");
	const entries = await readdir(root, { withFileTypes: true });
	const sessions = [];
	const ids = /* @__PURE__ */ new Set();
	for (const entry of entries) {
		const path = join(root, entry.name);
		const info = await lstat(path);
		if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`);
		if (entry.name === ".quarantine") {
			if (!info.isDirectory()) throw new Error(`session root quarantine must be a directory: ${path}`);
			if ((await readdir(path)).length > 0) throw new Error(`session root quarantine is not empty: ${path}`);
			continue;
		}
		if (!info.isDirectory()) throw new Error(`session root contains an unexpected file: ${path}`);
		const projectEntries = await readdir(path, { withFileTypes: true });
		const generationPaths = [];
		for (const sessionEntry of projectEntries) {
			const sessionPath = join(path, sessionEntry.name);
			const sessionInfo = await lstat(sessionPath);
			if (sessionInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${sessionPath}`);
			if (!sessionInfo.isDirectory()) throw new Error(`project directory contains an unexpected flat artifact: ${sessionPath}`);
			const sessionFiles = await readdir(sessionPath, { withFileTypes: true });
			const generations = [];
			for (const fileEntry of sessionFiles) {
				const filePath = join(sessionPath, fileEntry.name);
				const version = parseGenerationLogFilename(fileEntry.name, compression);
				if (parseGenerationLogFilename(fileEntry.name, compression === "zstd" ? "none" : "zstd") !== void 0) throw new Error(`session root mixes JSONL compression encodings: ${filePath}`);
				const fileInfo = await lstat(filePath);
				if (fileInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${filePath}`);
				if (fileEntry.name === "session.lock") {
					if (!fileInfo.isFile()) throw new Error(`session lock is not a regular file: ${filePath}`);
					continue;
				}
				if (version === void 0) throw new Error(`session directory contains an unexpected entry: ${filePath}`);
				if (!fileInfo.isFile()) throw new Error(`session generation is not a regular file: ${filePath}`);
				generations.push({
					path: filePath,
					version
				});
			}
			if (generations.length === 0) throw new Error(`session directory contains no generation: ${sessionPath}`);
			generations.sort((left, right) => left.version - right.version);
			const session = await auditSession(root, sessionPath, generations, compression);
			if (ids.has(session.id)) throw new Error(`duplicate session id in root: ${JSON.stringify(session.id)}`);
			ids.add(session.id);
			sessions.push(session);
			for (const generation of session.generations) generationPaths.push({
				path: generation.path,
				version: generation.storedVersion
			});
		}
	}
	if (!options.skipOwnershipCheck && options.ownershipManifest !== void 0) validateOwnership(sessions, await readOwnershipManifest(options.ownershipManifest));
	const files = await listRootFiles(root);
	return toPublicAudit({
		root,
		compression,
		currentVersion: sessionFormatCatalog.currentVersion,
		sessions,
		files: publicFiles(root, files),
		filePaths: files.map((file) => file.path)
	});
}
async function freshAuditWork(options) {
	const root = resolve(options.root);
	const compression = options.compression;
	if (compression !== "none" && compression !== "zstd") throw new Error(`unsupported JSONL compression: ${compression}`);
	await assertDirectory(root, "session root");
	const entries = await readdir(root, { withFileTypes: true });
	const sessions = [];
	const ids = /* @__PURE__ */ new Set();
	for (const entry of entries) {
		const project = join(root, entry.name);
		const info = await lstat(project);
		if (info.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${project}`);
		if (entry.name === ".quarantine") {
			if (!info.isDirectory()) throw new Error(`session root quarantine must be a directory: ${project}`);
			if ((await readdir(project)).length > 0) throw new Error(`session root quarantine is not empty: ${project}`);
			continue;
		}
		if (!info.isDirectory()) throw new Error(`session root contains an unexpected file: ${project}`);
		for (const sessionEntry of await readdir(project, { withFileTypes: true })) {
			const directory = join(project, sessionEntry.name);
			const sessionInfo = await lstat(directory);
			if (sessionInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${directory}`);
			if (!sessionInfo.isDirectory()) throw new Error(`project directory contains an unexpected flat artifact: ${directory}`);
			const generations = [];
			for (const fileEntry of await readdir(directory, { withFileTypes: true })) {
				const path = join(directory, fileEntry.name);
				const version = parseGenerationLogFilename(fileEntry.name, compression);
				if (parseGenerationLogFilename(fileEntry.name, compression === "zstd" ? "none" : "zstd") !== void 0) throw new Error(`session root mixes JSONL compression encodings: ${path}`);
				const fileInfo = await lstat(path);
				if (fileInfo.isSymbolicLink()) throw new Error(`session root contains a symbolic link: ${path}`);
				if (fileEntry.name === "session.lock") {
					if (!fileInfo.isFile()) throw new Error(`session lock is not a regular file: ${path}`);
					continue;
				}
				if (version === void 0) throw new Error(`session directory contains an unexpected entry: ${path}`);
				if (!fileInfo.isFile()) throw new Error(`session generation is not a regular file: ${path}`);
				generations.push({
					path,
					version
				});
			}
			if (generations.length === 0) throw new Error(`session directory contains no generation: ${directory}`);
			generations.sort((left, right) => left.version - right.version);
			const session = await auditSession(root, directory, generations, compression);
			if (ids.has(session.id)) throw new Error(`duplicate session id in root: ${JSON.stringify(session.id)}`);
			ids.add(session.id);
			sessions.push(session);
		}
	}
	if (!options.skipOwnershipCheck && options.ownershipManifest !== void 0) validateOwnership(sessions, await readOwnershipManifest(options.ownershipManifest));
	const files = await listRootFiles(root);
	return {
		...toPublicAudit({
			root,
			compression,
			currentVersion: sessionFormatCatalog.currentVersion,
			sessions,
			files: publicFiles(root, files),
			filePaths: files.map((file) => file.path)
		}),
		sessions,
		filePaths: files.map((file) => file.path)
	};
}
function assertBackupPathSafe(root, backupDir) {
	if (pathInside(root, backupDir) || pathInside(backupDir, root)) throw new Error(`backup directory must be disjoint from the session root: ${backupDir}`);
}
async function ensureEmptyDirectory(path) {
	try {
		const info = await lstat(path);
		if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`backup path is not a directory: ${path}`);
		if ((await readdir(path)).length !== 0) throw new Error(`backup directory is not empty: ${path}`);
	} catch (error) {
		if (error?.code === "ENOENT") {
			await mkdir(path, {
				recursive: true,
				mode: 448
			});
			return;
		}
		throw error;
	}
}
async function verifyBackupFiles(root, expected) {
	const actual = await listRootFiles(root);
	const byPath = new Map(actual.map((file) => [relativeFilePath(root, file.path), file]));
	const expectedPaths = new Set(expected.map((file) => file.path));
	if (byPath.size !== expectedPaths.size || [...byPath.keys()].some((path) => !expectedPaths.has(path))) throw new Error(`backup file inventory differs from its manifest: ${root}`);
	for (const file of expected) {
		const actualFile = byPath.get(file.path);
		if (actualFile === void 0 || actualFile.bytes !== file.bytes || actualFile.sha256 !== file.sha256) throw new Error(`backup file bytes differ from its manifest: ${file.path}`);
	}
}
async function createBackup(root, backupDir, postgresUri, skipPostgresBackup) {
	const target = resolve(backupDir);
	assertBackupPathSafe(root.root, target);
	await ensureEmptyDirectory(target);
	const sessionsTarget = join(target, "sessions");
	await cp(root.root, sessionsTarget, {
		recursive: true,
		force: false,
		errorOnExist: true,
		preserveTimestamps: true
	});
	await verifyBackupFiles(sessionsTarget, root.files);
	let postgresDump = null;
	if (!skipPostgresBackup) {
		if (typeof postgresUri !== "string" || postgresUri.trim() === "") throw new Error("a PostgreSQL URI is required for migration unless --skip-postgres-backup is explicit");
		postgresDump = join(target, "ownership-settings.dump");
		try {
			await execFileAsync("pg_dump", [
				"--format=custom",
				"--file",
				postgresDump,
				postgresUri
			], { maxBuffer: 1024 * 1024 });
		} catch (error) {
			throw new Error("PostgreSQL ownership/settings backup failed; no successor was published", { cause: error });
		}
		await assertRegularFile(postgresDump, "PostgreSQL backup");
	}
	const manifest = {
		schemaVersion: 1,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		sourceRoot: root.root,
		compression: root.compression,
		currentVersion: root.currentVersion,
		files: root.files,
		postgresDump: postgresDump === null ? null : basename(postgresDump)
	};
	await writeFile(join(target, BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, {
		encoding: "utf8",
		mode: 384,
		flag: "wx"
	});
	return {
		backupDir: target,
		postgresDump
	};
}
async function loadBackupManifest(backupDir) {
	const path = join(resolve(backupDir), BACKUP_MANIFEST);
	let parsed;
	try {
		parsed = JSON.parse(await readFile(path, "utf8"));
	} catch (error) {
		throw new Error(`backup manifest is not readable: ${path}`, { cause: error });
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.files)) throw new Error(`backup manifest is malformed: ${path}`);
	return parsed;
}
/**
* Back up the exact session root and PostgreSQL ownership/settings data, then
* publish only verified v3 successors. A partial interruption is resumable:
* historical generations remain intact and an existing target is accepted
* only when its bytes verify exactly.
*/
async function migrateSessionRoot(options) {
	if (!options.skipOwnershipCheck && options.ownershipManifest === void 0) throw new Error("an ownership manifest is required for migration unless --skip-ownership-check is explicit");
	const beforeWork = await freshAuditWork(options);
	const backup = await createBackup(beforeWork, options.backupDir, options.postgresUri, options.skipPostgresBackup === true);
	for (const session of beforeWork.sessions) for (const generation of session.generations) {
		if (!generation.selected || generation.storedVersion >= beforeWork.currentVersion) continue;
		if (generation.prepared === void 0) throw new Error(`historical session was not prepared: ${generation.path}`);
		await assertUnchanged(generation.path, generation.identity, generation.sha256);
		try {
			await generation.prepared.publish();
		} catch (error) {
			throw new Error(`could not publish verified successor for ${session.id}`, { cause: error });
		}
		await verifyJsonlCurrentGeneration(generation.currentPath, beforeWork.compression, session.id, generation.eventCount);
		await assertUnchanged(generation.path, generation.identity, generation.sha256);
	}
	const afterWork = await freshAuditWork(options);
	const publishedSessionIds = beforeWork.sessions.filter((session) => session.selectedVersion < beforeWork.currentVersion).map((session) => session.id);
	await writeFile(join(backup.backupDir, MIGRATION_MANIFEST), `${JSON.stringify({
		schemaVersion: 1,
		completedAt: (/* @__PURE__ */ new Date()).toISOString(),
		publishedSessionIds,
		before: toPublicAudit(beforeWork),
		after: toPublicAudit(afterWork)
	}, null, 2)}\n`, {
		encoding: "utf8",
		mode: 384,
		flag: "wx"
	});
	return {
		backupDir: backup.backupDir,
		postgresDump: backup.postgresDump,
		publishedSessionIds,
		before: toPublicAudit(beforeWork),
		after: toPublicAudit(afterWork)
	};
}
/** Restore a verified backup, retaining the current root as a timestamped rollback sibling. */
async function rollbackSessionRoot(options) {
	if (!options.yes) throw new Error("rollback is destructive to the current root; pass --yes to confirm");
	const root = resolve(options.root);
	const backupDir = resolve(options.backupDir);
	assertBackupPathSafe(root, backupDir);
	const manifest = await loadBackupManifest(backupDir);
	const sessionsBackup = join(backupDir, "sessions");
	await assertDirectory(sessionsBackup, "backup session root");
	await verifyBackupFiles(sessionsBackup, manifest.files);
	await assertDirectory(root, "current session root");
	const displaced = `${root}.rollback-${Date.now()}-${randomBytes(4).toString("hex")}`;
	await rename(root, displaced);
	try {
		await cp(sessionsBackup, root, {
			recursive: true,
			force: false,
			errorOnExist: true,
			preserveTimestamps: true
		});
		await verifyBackupFiles(root, manifest.files);
	} catch (error) {
		try {
			await rm(root, {
				recursive: true,
				force: true
			});
			await rename(displaced, root);
		} catch (restoreError) {
			throw new AggregateError([asError(error), asError(restoreError)], "rollback failed and current root could not be restored");
		}
		throw new Error("rollback failed; current root was restored", { cause: error });
	}
	return {
		restoredFrom: sessionsBackup,
		displacedCurrentRoot: displaced
	};
}
/** Names used by the CLI and tests without exposing private file names. */
const sessionMigrationFiles = Object.freeze({
	backupManifest: BACKUP_MANIFEST,
	migrationManifest: MIGRATION_MANIFEST
});
//#endregion
export { auditSessionRoot, migrateSessionRoot, rollbackSessionRoot, sessionMigrationFiles };
