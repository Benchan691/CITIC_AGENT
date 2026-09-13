import { C as sessionDir, D as ensureDurableDirectoryWin32, E as SessionWriteLease, O as publishNewFileWin32, S as scanLog, _ as generationLogPath, a as readStableJsonlFile, b as parseGenerationLogFilename, c as createZstdFrameDecoder, d as scanZstdFrames, f as SessionLogScanner, g as generationLogFilename, h as eventLines, l as decompressZstdFrame, m as encodeSegment, n as JsonlGenerationUnsupportedMigrationError, p as assertNoRetiredHeaderFields, r as prepareJsonlMigration, s as compressZstdFrame, t as JsonlGenerationSourceChangedError, u as decompressZstdPrefix, v as logPath, w as toHeaderLine, x as projectDir, y as logSuffix } from "./generation-BkeoNAc_.js";
import z from "@deepseek-ai/schemastery";
import { SessionFormatUnsupportedMigrationError, sessionFormatCatalog } from "@deepseek-ai/dsh-session-format-catalog";
import { readdirSync } from "node:fs";
import { link, mkdir, open, readdir, realpath, rename, rm, stat, truncate } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { scheduler } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import { SessionAlreadyExistsError, SessionAlreadyOwnedError, SessionFormatUnsupportedError, SessionHandleClosedError, SessionPersistence, SessionPersistenceCorruptionError, SessionPersistenceNotFoundError, SessionPersistenceRevision, SessionReadOnlyError, assertContiguous, assertStoredId, materializeAppendBatch, materializeCreateHeader, sessionFormatVersionRefusal, validateStoredEvents } from "@deepseek-ai/dsh-session-persistence";
import { errorChain } from "@deepseek-ai/dsh-llm";
import { SESSION_FORMAT_VERSION, SessionId, SessionLogOffset } from "@deepseek-ai/dsh-session";
import { Worker } from "node:worker_threads";
/**
* The JSONL session handle. Mutations serialize on a per-handle promise
* chain; reads re-scan the artifact on demand and never observe a shorter log
* than a prior read on this handle. Routed live events buffer in a bounded
* window and drain through the same chain as explicit appends.
*/
var JsonlSessionHandle = class {
	storage;
	id;
	header;
	access;
	state;
	lease;
	chain = Promise.resolve();
	closing;
	observedLength = 0;
	/** Routed live events awaiting their batching deadline (persistence-owned copies). */
	buffered = [];
	batchTimer;
	/** Set when a drain failed; the automatic timer stays quiet until the next drain. */
	drainPaused = false;
	draining;
	constructor(storage, id, header, access, state, lease) {
		this.storage = storage;
		this.id = id;
		this.header = header;
		this.access = access;
		this.state = state;
		this.lease = lease;
	}
	/** Exact fork-inherited prefix length stored with this session's log. */
	get inheritedEventCount() {
		return this.state.inheritedEventCount;
	}
	/**
	* Read a slice of the valid contiguous logical log; see the seam contract.
	* @param offset - first logical seq to include (default 0).
	* @param length - maximum events returned (default: the rest).
	* @param options - optional cancellation.
	* @returns a slice carrying the aliasing state established by its producer.
	*/
	async read(offset = 0, length = Number.MAX_SAFE_INTEGER, options) {
		this.assertOpen("read");
		if (!Number.isSafeInteger(offset) || offset < 0) throw new TypeError(`read offset must be a non-negative safe integer, got ${String(offset)}`);
		if (!Number.isSafeInteger(length) || length < 0) throw new TypeError(`read length must be a non-negative safe integer, got ${String(length)}`);
		options?.signal?.throwIfAborted();
		let result;
		const primed = this.state.primed;
		if (primed !== void 0) if (this.access === "write") result = this.readPrimed(primed, offset, length);
		else {
			const currentPath = await this.storage.resolveCurrentLog(this.id, options?.signal);
			if (currentPath === void 0) result = this.readPrimed(primed, offset, length);
			else {
				this.state.primed = void 0;
				result = await this.readCurrent(currentPath, offset, length, options?.signal);
			}
		}
		else if (this.access === "write" && !this.state.materialized) result = {
			eventState: "detached",
			events: []
		};
		else {
			const currentPath = await this.storage.resolveCurrentLog(this.id, options?.signal);
			if (currentPath !== void 0) result = await this.readCurrent(currentPath, offset, length, options?.signal);
			else if (this.storage.hasPendingSession(this.id)) result = {
				eventState: "detached",
				events: []
			};
			else throw new SessionPersistenceNotFoundError(this.id);
		}
		return result;
	}
	/** Read one slice from the prepared historical prefix retained by this handle. */
	readPrimed(source, offset, length) {
		this.observedLength = Math.max(this.observedLength, source.events.length);
		return {
			eventState: source.eventState,
			events: source.events.slice(offset, offset + length)
		};
	}
	/** Read one current physical generation and enforce this handle's monotonic view. */
	async readCurrent(path, offset, length, signal) {
		const source = await this.storage.readStoredLog(path, this.id, signal);
		if (source.events.length < this.observedLength) throw new Error(`session "${this.id}": stored log shrank below a previously observed prefix (${source.events.length} < ${this.observedLength})`);
		this.observedLength = source.events.length;
		return {
			eventState: source.eventState,
			events: source.events.slice(offset, offset + length)
		};
	}
	/**
	* Durably append a contiguous batch; see the seam contract.
	* @param events - the contiguous batch in seq order.
	* @param options - optional cancellation observed before the write starts.
	*/
	async append(events, options) {
		this.assertOpen("append");
		const batch = materializeAppendBatch(events);
		return this.run("append", async () => {
			options?.signal?.throwIfAborted();
			await this.persistContiguous(batch);
		});
	}
	/**
	* Durability barrier; materializes the artifact when nothing has been
	* appended yet, so an explicitly flushed empty session survives this process.
	* @param options - optional cancellation observed before the barrier starts.
	*/
	flush(options) {
		return this.run("flush", async () => {
			options?.signal?.throwIfAborted();
			if (this.access !== "write") throw new SessionReadOnlyError(this.id, "flush");
			if (this.state.materialized) return;
			await this.ensureLease();
			await this.storage.persistHeader(this.header, this.state.inheritedEventCount);
			this.state.materialized = true;
		});
	}
	/**
	* Release the handle; see the seam contract. Idempotent and uncancellable.
	* A write handle first drains its routed live buffer through the still-open
	* storage, so backend teardown loses nothing regardless of which fiber
	* unwinds first; a drain or lock-release failure still frees the in-process
	* claim, then rejects — both failures together reject as one
	* `AggregateError`.
	* @returns settlement of the release.
	*/
	close() {
		return this.closing ??= (async () => {
			let drainFailure;
			for (;;) {
				try {
					await this.drainLive();
				} catch (error) {
					drainFailure = error;
					break;
				}
				await this.chain;
				if (this.buffered.length === 0) break;
			}
			await this.chain;
			const failures = [];
			if (drainFailure !== void 0) failures.push(drainFailure instanceof Error ? drainFailure : new Error(errorChain(drainFailure)));
			try {
				await this.lease?.release();
			} catch (releaseFailure) {
				/* v8 ignore next -- lock releases reject with Error */
				failures.push(releaseFailure instanceof Error ? releaseFailure : new Error(errorChain(releaseFailure)));
			}
			this.storage.releaseHandle(this, this.state.materialized);
			if (failures.length > 1) throw new AggregateError(failures, `session "${this.id}": close failed to drain and to release its write lock`);
			if (failures[0] !== void 0) throw failures[0];
		})();
	}
	/** `await using` support: delegates to {@link close}. */
	[Symbol.asyncDispose]() {
		return this.close();
	}
	/**
	* Buffer one published live session event and arm the bounded batching
	* window when it is idle. The routing installer is the only caller.
	* @param event - the live event, retained as a persistence-owned copy.
	* @param reportBackgroundFailure - observes a deadline-driven drain failure
	*   (the events stay buffered; the next {@link drainLive} retries loudly).
	*/
	enqueueLive(event, reportBackgroundFailure) {
		this.buffered.push(structuredClone(event));
		if (this.batchTimer !== void 0 || this.drainPaused) return;
		this.batchTimer = setTimeout(() => {
			this.batchTimer = void 0;
			this.drainLive().catch(reportBackgroundFailure);
		}, 200);
	}
	/**
	* Durably drain the routed live buffer through the mutation chain;
	* concurrent callers join one drain, and a failure retains the batch in
	* order so `session/flush` can retry and reject loudly.
	*/
	drainLive() {
		return this.draining ??= this.drainBuffered().finally(() => {
			this.draining = void 0;
		});
	}
	async drainBuffered() {
		if (this.batchTimer !== void 0) {
			clearTimeout(this.batchTimer);
			this.batchTimer = void 0;
		}
		this.drainPaused = false;
		while (this.buffered.length > 0) await this.enqueueChain(async () => {
			const batch = this.buffered.splice(0);
			try {
				await this.persistContiguous(materializeAppendBatch(batch));
			} catch (error) {
				this.buffered = batch.concat(this.buffered);
				this.drainPaused = true;
				throw error;
			}
		});
	}
	/** The shared durable-append body: contiguity, ownership, torn-tail repair, storage write, state advance. */
	async persistContiguous(batch) {
		if (this.access !== "write") throw new SessionReadOnlyError(this.id, "append");
		if (batch.length === 0) return;
		await this.ensureLease();
		assertContiguous(this.id, batch, this.state.cursor);
		if (this.state.tornTruncateTo !== void 0) {
			await this.storage.truncateTornTail(this.header, this.state.tornTruncateTo);
			this.state.tornTruncateTo = void 0;
		}
		if (this.state.recoveredTail !== void 0) {
			if (this.state.recoveredTail.length > 0) await this.storage.persistBatch(this.header, this.state.recoveredTail, this.state.materialized, this.state.inheritedEventCount);
			this.state.recoveredTail = void 0;
		}
		await this.storage.persistBatch(this.header, batch, this.state.materialized, this.state.inheritedEventCount);
		this.state.materialized = true;
		this.state.cursor += batch.length;
		this.state.primed = void 0;
		this.observedLength = this.state.cursor;
	}
	/**
	* Hold the cross-process write lock before this session's first durable
	* write. An open write handle holds it from construction; a create handle
	* acquires it here — immediately before the first log bytes publish — and
	* keeps it through close even when materialization then fails, so a
	* materializing session stays exclusively owned across retries.
	*/
	async ensureLease() {
		this.lease ??= await this.storage.acquireWriteLease(this.header);
	}
	/** Serialize one operation onto the chain without the closed-handle refusal (drain-from-close). */
	enqueueChain(op) {
		const next = this.chain.then(op);
		this.chain = next.catch(() => {});
		return next;
	}
	/** Serialize one public mutating operation onto this handle's chain. */
	async run(operation, op) {
		this.assertOpen(operation);
		return this.enqueueChain(async () => {
			this.assertOpen(operation);
			return op();
		});
	}
	assertOpen(operation) {
		if (this.closing !== void 0) throw new SessionHandleClosedError(this.id, operation);
	}
};
/**
* The JSONL backend's in-process bookkeeping: the single active writer per
* session id (doubling as the live event router), the open-handle set the
* teardown sweep closes, and the created-but-unmaterialized sessions this
* process can already observe.
*/
var JsonlBackendTracker = class {
	name;
	/** Every open handle; teardown closes what remains. */
	openHandles = /* @__PURE__ */ new Set();
	/** `null` marks a claim whose handle is still being constructed. */
	writers = /* @__PURE__ */ new Map();
	pending = /* @__PURE__ */ new Map();
	counter = 0;
	/** @param name - backend label used in in-memory revision tokens and teardown errors. */
	constructor(name) {
		this.name = name;
	}
	/**
	* Claim write ownership and record the created session as pending, making
	* it observable to this process before it materializes. Before
	* materialization this registration is the only guard — session ids do not
	* collide across processes, and no durable artifact exists for another
	* process to open; the handle takes the cross-process lock at its first
	* materializing write.
	* @param header - the validated detached header.
	* @param inheritedEventCount - the exact fork-inherited prefix length.
	* @throws {SessionAlreadyExistsError} when a concurrent create or an open
	*   write handle holds the id — for create, the duplicate is the fact.
	*/
	registerCreated(header, inheritedEventCount) {
		if (this.writers.has(header.id)) throw new SessionAlreadyExistsError(header.id);
		this.writers.set(header.id, null);
		this.pending.set(header.id, {
			header,
			revision: SessionPersistenceRevision(`memory:${this.name}:${++this.counter}`),
			inheritedEventCount
		});
	}
	/**
	* Claim write ownership for an existing session.
	* @param id - the session to claim.
	* @throws {SessionAlreadyOwnedError} when an active write handle exists.
	*/
	claimWrite(id) {
		if (this.writers.has(id)) throw new SessionAlreadyOwnedError(id);
		this.writers.set(id, null);
	}
	/**
	* Roll a failed write open back.
	* @param id - the session whose claim is dropped.
	*/
	releaseClaim(id) {
		this.writers.delete(id);
	}
	/**
	* The pending entry for a created-but-unmaterialized session, if any.
	* @param id - the session to look up.
	* @returns the pending header and in-memory revision.
	*/
	pendingOf(id) {
		return this.pending.get(id);
	}
	/**
	* Whether this process still tracks a created-but-unmaterialized session.
	* @param id - the session to test.
	* @returns true while the pending entry exists.
	*/
	hasPending(id) {
		return this.pending.has(id);
	}
	/**
	* Iterate the pending sessions for listing.
	* @returns the pending entries, keyed by session id.
	*/
	pendingEntries() {
		return this.pending.entries();
	}
	/** Close every local handle for one id before a permanent deletion. */
	async closeSession(id) {
		const pending = this.pending.has(id);
		const handles = [...this.openHandles].filter((handle) => handle.id === id);
		const failures = (await Promise.allSettled(handles.map((handle) => handle.close()))).flatMap((result) => result.status === "rejected" ? [result.reason] : []);
		if (failures.length > 0) throw new AggregateError(failures, `session "${id}": active handles could not be closed for deletion`);
		this.pending.delete(id);
		this.writers.delete(id);
		return pending || handles.length > 0;
	}
	/**
	* Drop a pending entry once the session materialized durably.
	* @param id - the session that reached durable storage.
	*/
	materialized(id) {
		this.pending.delete(id);
	}
	/**
	* Track one open handle for teardown and, for a write handle, bind it as
	* the session's live event route.
	* @param handle - the just-constructed handle.
	* @returns the same handle, for construction-site chaining.
	*/
	adopt(handle) {
		this.openHandles.add(handle);
		if (handle.access === "write") this.writers.set(handle.id, handle);
		return handle;
	}
	/**
	* Release one handle's bookkeeping on close. A write handle drops its
	* ownership claim; a creator that never materialized leaves nothing behind —
	* the session never existed.
	* @param handle - the closing handle.
	* @param materialized - whether the session reached durable storage.
	*/
	release(handle, materialized) {
		this.openHandles.delete(handle);
		if (handle.access !== "write") return;
		this.writers.delete(handle.id);
		if (!materialized) this.pending.delete(handle.id);
	}
	/**
	* Drain and flush every active write handle — the service-wide durability
	* barrier behind `SessionPersistence.flush`.
	* @throws {AggregateError} naming each session whose flush failed; the
	*   remaining handles still flush.
	*/
	async flushAll() {
		const errors = [];
		for (const writer of [...this.writers.values()]) {
			if (writer === null) continue;
			try {
				await writer.drainLive();
				await writer.flush();
			} catch (error) {
				if (error instanceof SessionHandleClosedError) continue;
				errors.push(error);
			}
		}
		if (errors.length > 0) throw new AggregateError(errors, `${this.name} flush failed`);
	}
	/**
	* Install the backend's live session routing and teardown. Persistence
	* enforces one active write handle per id, so the listeners route published
	* sessions' events by id; the teardown effect closes every open handle —
	* close drains the routed buffer — and aggregates failures. This provider
	* owns no separate storage connection, so closing handles is the complete
	* teardown. Registrations are effects of the current fiber.
	* @param ctx - the backend's context.
	*/
	install(ctx) {
		ctx.on("session/event", (session, event) => {
			this.writers.get(session.id)?.enqueueLive(event, (error) => {
				ctx.logger.warn(`session-persistence: background write for session "${session.id}" failed (buffered events retained): ${String(error)}`);
			});
		});
		ctx.on("session/flush", (session) => {
			const writer = this.writers.get(session.id);
			if (writer === null || writer === void 0) return void 0;
			return (async () => {
				await writer.drainLive();
				await writer.flush();
			})();
		});
		ctx.on("session/disposed", (session) => {
			const writer = this.writers.get(session.id);
			if (writer === null || writer === void 0) return;
			writer.close().catch((error) => {
				ctx.logger.warn(`session-persistence: final drain for session "${session.id}" failed: ${String(error)}`);
			});
		});
		ctx.effect(() => async () => {
			const errors = [];
			for (const handle of [...this.openHandles]) try {
				await handle.close();
			} catch (error) {
				errors.push(error);
			}
			if (errors.length > 0) throw new AggregateError(errors, `${this.name} dispose failed`);
		}, `${this.name} open handles`);
	}
};
//#endregion
//#region src/migration-verifier.ts
/** Isolated verification for a staged or competing current JSONL generation. */
/** Process-wide memory bound for full-generation verification isolates. */
const MAX_CONCURRENT_VERIFIERS = 2;
var VerificationScheduler = class {
	active = 0;
	waiting = [];
	async run(operation, signal) {
		const permit = this.acquire(signal);
		if (permit !== void 0) await permit;
		try {
			signal?.throwIfAborted();
			return await operation();
		} finally {
			this.release();
		}
	}
	acquire(signal) {
		signal?.throwIfAborted();
		if (this.active < MAX_CONCURRENT_VERIFIERS) {
			this.active += 1;
			return;
		}
		return new Promise((resolve, reject) => {
			const waiter = { grant: () => {
				signal?.removeEventListener("abort", abort);
				resolve();
			} };
			const abort = () => {
				const index = this.waiting.indexOf(waiter);
				this.waiting.splice(index, 1);
				reject(verifierAbortError(signal));
			};
			this.waiting.push(waiter);
			signal?.addEventListener("abort", abort, { once: true });
		});
	}
	release() {
		const next = this.waiting.shift();
		if (next === void 0) {
			this.active -= 1;
			return;
		}
		next.grant();
	}
};
const verificationScheduler = new VerificationScheduler();
function workerSpawn(request) {
	/* v8 ignore next 3 -- built-worker coverage owns the bundled path. */
	if (!import.meta.url.endsWith(".ts")) return {
		entry: new URL("./worker.cjs", import.meta.url),
		options: {
			workerData: request,
			execArgv: []
		}
	};
	const workerEntry = new URL("./worker.ts", import.meta.url);
	const bootstrap = [
		`import { register as registerEsm } from ${JSON.stringify(import.meta.resolve("tsx/esm/api"))}`,
		`import { register as registerCjs } from ${JSON.stringify(import.meta.resolve("tsx/cjs/api"))}`,
		"registerCjs()",
		"registerEsm()",
		`await import(${JSON.stringify(workerEntry.href)})`
	].join("\n");
	return {
		entry: new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`),
		options: {
			workerData: request,
			execArgv: []
		}
	};
}
/**
* Verify one current generation in a fresh Worker Thread.
* @param path - staged or competing current-generation path.
* @param compression - configured physical encoding.
* @param expectedId - Session id expected in the decoded header.
* @param expectedEventCount - exact logical event count expected after decoding.
* @param expectedPrefix - verified physical prefix; an append tail may be present and is not validated.
* @param signal - optional cancellation for scheduler wait and Worker execution.
* @returns stable physical identity and digest observed by the worker.
*/
function verifyCurrentGenerationInWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal) {
	return verificationScheduler.run(() => runVerificationWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal), signal);
}
function runVerificationWorker(path, compression, expectedId, expectedEventCount, expectedPrefix, signal) {
	signal?.throwIfAborted();
	const { entry, options } = workerSpawn({
		path,
		compression,
		expectedId,
		expectedEventCount,
		...expectedPrefix === void 0 ? {} : { expectedPrefix }
	});
	const worker = new Worker(entry, options);
	return new Promise((resolve, reject) => {
		let settled = false;
		const cleanup = () => {
			signal?.removeEventListener("abort", abort);
		};
		const fail = (error) => {
			/* v8 ignore next -- a late error/exit races only after another terminal callback settled. */
			if (settled) return;
			settled = true;
			cleanup();
			worker.terminate().then(() => {
				reject(error);
			}, (cleanup) => {
				reject(new AggregateError([error, cleanup], "migration verifier termination failed"));
			});
		};
		worker.once("message", (value) => {
			/* v8 ignore next -- a duplicate message races only after another terminal callback settled. */
			if (settled) return;
			if (typeof value !== "object" || value === null || typeof value.ok !== "boolean") {
				fail(/* @__PURE__ */ new Error("migration verifier returned an invalid response"));
				return;
			}
			const response = value;
			if (!response.ok) {
				const error = new Error(response.message);
				if (response.stack !== void 0) error.stack = response.stack;
				fail(error);
				return;
			}
			settled = true;
			cleanup();
			worker.terminate().then(() => {
				resolve(response.result);
			}, (error) => {
				reject(error instanceof Error ? error : new Error(String(error)));
			});
		});
		worker.once("error", fail);
		worker.once("exit", (code) => {
			if (!settled) fail(/* @__PURE__ */ new Error(`migration verifier exited before reporting a result (code ${code})`));
		});
		const abort = () => {
			fail(verifierAbortError(signal));
		};
		signal?.addEventListener("abort", abort, { once: true });
	});
}
function verifierAbortError(signal) {
	const reason = signal?.reason;
	return reason instanceof Error ? reason : new Error("migration verifier aborted", { cause: reason });
}
//#endregion
//#region src/index.ts
/**
* Internal handoff-reuse policy, not deployment configuration: a cold
* observation and the resume that immediately follows it reuse one parsed
* log, so the memo only needs the sessions in flight between those steps.
*/
const COLD_LOG_MEMO_MAX_ENTRIES = 2;
const DEFAULT_COMPRESSION = "zstd";
/**
* Internal scheduling constant, not deployment configuration: balance
* frame-boundary event-loop yields against `setImmediate` overhead. One frame
* remains an indivisible synchronous decode.
*/
const ZSTD_DECODE_YIELD_INTERVAL_MS = 500;
/** Assert that the independently decodable first frame contains only the header record. */
function assertZstdHeaderFrame(plaintext) {
	if (plaintext.length === 0 || plaintext.indexOf(10) !== plaintext.length - 1) throw new Error("corrupt Zstandard session log: first frame is not exactly one header line");
}
/** Loader schema for the JSONL artifact's physical encoding. */
const JsonlCompressionSchema = z.union([z.const("zstd"), z.const("none")]).default(DEFAULT_COMPRESSION);
/** Deep-freeze one acyclic stored JSON event without recursive calls. */
function freezeStoredEvent(event) {
	const pending = [event];
	while (pending.length > 0) {
		const current = pending.pop();
		Object.freeze(current);
		for (const key in current) {
			const child = current[key];
			if (child !== null && typeof child === "object") pending.push(child);
		}
	}
}
/** Establish immutable sharing for one decoded event graph and report that state. */
function freezeStoredEvents(events) {
	for (const event of events) freezeStoredEvent(event);
	Object.freeze(events);
	return {
		eventState: "shared-frozen",
		events
	};
}
/** Build the stat-derived best-effort change token shared by full and lightweight reads. */
function fileRevision(identity) {
	return SessionPersistenceRevision([
		identity.dev,
		identity.ino,
		identity.size,
		identity.mtimeNs,
		identity.ctimeNs
	].join(":"));
}
/** Whether a filesystem error means absence; every non-ENOENT failure must surface. */
function isENOENT(error) {
	return error?.code === "ENOENT";
}
/** Whether a filesystem-owned failure should retain its original errno and path. */
function isErrnoException(error) {
	return typeof error?.code === "string";
}
/** Preserve an Error abort reason and normalize hostile non-Error reasons. */
function abortError(signal) {
	return signal.reason instanceof Error ? signal.reason : new Error("session migration preparation aborted", { cause: signal.reason });
}
/** Let one caller stop waiting without transferring cancellation ownership to shared work. */
function waitWithAbort(operation, signal) {
	if (signal === void 0) return operation;
	/* v8 ignore next -- requireStoredLog synchronously rechecks the signal immediately before waiting. */
	if (signal.aborted) return Promise.reject(abortError(signal));
	return new Promise((resolve, reject) => {
		const stopWaiting = () => {
			reject(abortError(signal));
		};
		signal.addEventListener("abort", stopWaiting, { once: true });
		operation.then((value) => {
			signal.removeEventListener("abort", stopWaiting);
			resolve(value);
		}, (error) => {
			signal.removeEventListener("abort", stopWaiting);
			/* v8 ignore else -- the preparation owner normalizes every rejection before this waiter sees it. */
			if (error instanceof Error) reject(error);
			else reject(new Error("session migration preparation failed", { cause: error }));
		});
	});
}
/**
* The JSONL persistence backend. Load as a plugin; it registers as
* `ctx.sessionPersistence`. Sessions materialize lazily: a created session is
* visible to this process immediately, reaches disk on its first append or
* flush, and never existed if the process crashes before that.
*/
var JsonlSessionPersistence = class extends SessionPersistence {
	config;
	static Config = z.object({
		root: z.string().required(),
		compression: JsonlCompressionSchema
	});
	/** Backend label for diagnostics and effects; shadows `Service.name` without changing the service key. */
	name = "session-persistence-jsonl";
	root;
	compression;
	rootEncodingCheck;
	tracker = new JsonlBackendTracker(this.name);
	generationFormat;
	/**
	* Bounded LRU of parsed, validated stored logs keyed by session id and
	* guarded by the stat-derived revision, so an immediate cold-read handoff
	* (observation then resume) parses the artifact once. Every local mutation
	* for an id invalidates its entry; a foreign write misses through the
	* revision guard.
	*/
	coldLogMemo = /* @__PURE__ */ new Map();
	/** One joinable decode/migration operation per selected historical Session file revision. */
	migrationPreparations = /* @__PURE__ */ new Map();
	constructor(ctx, config) {
		super(ctx);
		this.config = config;
		/* v8 ignore next 5 -- generated catalog and Session source share one build-time version owner. */
		if (sessionFormatCatalog.currentVersion !== SESSION_FORMAT_VERSION) throw new Error(`session-persistence-jsonl: format catalog v${sessionFormatCatalog.currentVersion} does not match Session v${SESSION_FORMAT_VERSION}`);
		this.root = resolve(config.root);
		this.compression = config.compression ?? DEFAULT_COMPRESSION;
		this.generationFormat = {
			currentVersion: sessionFormatCatalog.currentVersion,
			createRestore: (header) => sessionFormatCatalog.createRestore(header, {
				recovery: "recoverable",
				validation: "transformed"
			}),
			encodeHeader: (header, inheritedEventCount) => sessionFormatCatalog.encodeCurrentHeader(header, inheritedEventCount),
			encodeEvent: (event) => sessionFormatCatalog.encodeCurrentEvent(event),
			isUnsupportedMigrationError: (error) => error instanceof SessionFormatUnsupportedMigrationError
		};
		this.assertUsableRoot();
		this.tracker.install(ctx);
	}
	/**
	* Refusal-diagnostics hook: the absolute target path, without touching the filesystem.
	* @param meta - the stored header naming the session and its cwd.
	* @returns the artifact kind and absolute path.
	*/
	locate(meta) {
		return {
			kind: "jsonl",
			path: logPath(this.root, meta.cwd, meta.id, this.compression)
		};
	}
	/**
	* Create a new stored session and take its write ownership. The session is
	* visible to this process immediately; the physical artifact appears on the
	* first append or flush.
	* @param header - the immutable header to store; must be losslessly
	*   JSON-serializable with a non-negative safe-integer `createdAt`.
	* @param options - optional cancellation.
	* @returns the owned write handle.
	*/
	async create(header, options) {
		options?.signal?.throwIfAborted();
		const snapshot = materializeCreateHeader(header);
		toHeaderLine(snapshot, options?.inheritedEventCount);
		const inheritedEventCount = SessionLogOffset(options?.inheritedEventCount ?? 0);
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		if (this.tracker.hasPending(snapshot.id) || await this.findLog(snapshot.id, options?.signal) !== void 0) throw new SessionAlreadyExistsError(snapshot.id);
		options?.signal?.throwIfAborted();
		this.tracker.registerCreated(snapshot, inheritedEventCount);
		return this.tracker.adopt(new JsonlSessionHandle(this, snapshot.id, snapshot, "write", {
			cursor: 0,
			materialized: false,
			inheritedEventCount
		}));
	}
	/**
	* Open an existing stored session for `read` or single-writer `write`.
	* @param id - the stored session to open.
	* @param access - `read` (no ownership) or `write` (atomic in-process claim).
	* @param options - optional cancellation.
	* @returns the open handle.
	*/
	async open(id, access, options) {
		options?.signal?.throwIfAborted();
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		const pending = this.tracker.pendingOf(id);
		if (access === "read") {
			if (pending !== void 0) return this.tracker.adopt(new JsonlSessionHandle(this, id, pending.header, "read", {
				cursor: 0,
				materialized: false,
				inheritedEventCount: pending.inheritedEventCount
			}));
			const stored = await this.requireStoredLog(id, options?.signal);
			let state;
			if (stored.status === "prepared") state = {
				cursor: 0,
				materialized: true,
				inheritedEventCount: stored.inheritedEventCount,
				primed: stored
			};
			else state = {
				cursor: 0,
				materialized: true,
				inheritedEventCount: stored.inheritedEventCount
			};
			return this.tracker.adopt(new JsonlSessionHandle(this, id, stored.meta, "read", state));
		}
		this.tracker.claimWrite(id);
		let lease;
		try {
			const resolved = await this.findLog(id, options?.signal);
			if (resolved === void 0) throw new SessionPersistenceNotFoundError(id);
			lease = await this.acquireLease(id, void 0, dirname(resolved.currentPath));
			const prepared = await this.requireStoredLog(id, options?.signal);
			options?.signal?.throwIfAborted();
			let stored;
			if (prepared.status === "prepared") stored = await this.publishStoredMigration(id, prepared);
			else stored = prepared;
			options?.signal?.throwIfAborted();
			return this.tracker.adopt(new JsonlSessionHandle(this, id, stored.meta, "write", {
				cursor: stored.events.length,
				materialized: true,
				tornTruncateTo: stored.tornTruncateTo,
				recoveredTail: stored.recoveredTail,
				inheritedEventCount: stored.inheritedEventCount,
				primed: stored
			}, lease));
		} catch (error) {
			/* v8 ignore next -- typed backends and fs reject with Error */
			const failure = error instanceof Error ? error : new Error(String(error));
			let releaseFailure;
			try {
				await lease?.release();
			} catch (raw) {
				/* v8 ignore next -- lock releases reject with Error */
				releaseFailure = raw instanceof Error ? raw : new Error(String(raw));
			}
			this.tracker.releaseClaim(id);
			if (releaseFailure !== void 0) throw new AggregateError([failure, releaseFailure], `session "${id}": write open failed and its lock release failed`);
			throw failure;
		}
	}
	/**
	* Flush every active write handle in one durability barrier; see the seam
	* contract.
	* @returns resolution once every write handle active at the call has flushed.
	*/
	flush() {
		return this.tracker.flushAll();
	}
	/**
	* Observe one stored session without reading its event log.
	* @param id - the stored session to observe.
	* @param options - optional cancellation.
	* @returns the snapshot (`sizeBytes` carries the physical artifact size), or
	*   `undefined` when the session does not exist.
	*/
	async stat(id, options) {
		options?.signal?.throwIfAborted();
		await this.ensureRootEncoding();
		options?.signal?.throwIfAborted();
		const pending = this.tracker.pendingOf(id);
		if (pending !== void 0) return {
			header: pending.header,
			revision: pending.revision
		};
		const selected = await this.findLog(id, options?.signal);
		if (selected === void 0) return void 0;
		const header = await this.readGenerationHeader(selected, id, options?.signal);
		if (header === void 0) return void 0;
		try {
			const identity = await stat(selected.sourcePath, { bigint: true });
			options?.signal?.throwIfAborted();
			return {
				header,
				revision: fileRevision(identity),
				sizeBytes: Number(identity.size)
			};
		} catch (error) {
			options?.signal?.throwIfAborted();
			if (isENOENT(error)) return void 0;
			throw error;
		}
	}
	/**
	* List every stored session visible to this process: materialized artifacts
	* plus this process's created-but-unmaterialized sessions.
	* @param options - optional cancellation.
	* @returns one snapshot per session, in no promised order.
	*/
	async list(options) {
		const signal = options?.signal;
		const snapshots = [];
		const listed = /* @__PURE__ */ new Set();
		const pending = [...this.tracker.pendingEntries()];
		for (const artifact of await this.listArtifacts(signal)) {
			signal?.throwIfAborted();
			try {
				const identity = await stat(artifact.path, { bigint: true });
				signal?.throwIfAborted();
				listed.add(artifact.header.id);
				snapshots.push({
					header: artifact.header,
					revision: fileRevision(identity),
					sizeBytes: Number(identity.size)
				});
			} catch (error) {
				signal?.throwIfAborted();
				if (!isENOENT(error)) throw error;
			}
		}
		for (const [id, entry] of pending) if (!listed.has(id)) snapshots.push({
			header: entry.header,
			revision: entry.revision
		});
		signal?.throwIfAborted();
		return snapshots;
	}
	/**
	* Permanently remove one complete Session directory. The directory is first
	* moved atomically into a scanner-excluded quarantine under the same data
	* root, then every generation and lock is removed from that exact target.
	*/
	async deleteSession(id) {
		await this.ensureRootEncoding();
		const hadLocalState = await this.tracker.closeSession(id);
		this.migrationPreparations.get(id)?.controller.abort(/* @__PURE__ */ new Error(`session "${id}" is being deleted`));
		this.migrationPreparations.delete(id);
		this.coldLogMemo.delete(id);
		const selected = await this.findLog(id);
		if (selected === void 0) return hadLocalState;
		if (await this.readGenerationHeader(selected, id) === void 0) throw new SessionPersistenceCorruptionError(`session "${id}": stored generation has no valid header`, {});
		const directory = dirname(selected.sourcePath);
		if (basename(directory) !== encodeSegment(id)) throw new SessionPersistenceCorruptionError(`session "${id}": refusing to delete unexpected directory ${JSON.stringify(directory)}`, {});
		const [rootPath, directoryPath] = await Promise.all([realpath(this.root), realpath(directory)]);
		const withinRoot = relative(rootPath, directoryPath);
		if (withinRoot === "" || withinRoot === ".." || withinRoot.startsWith(`..${sep}`) || isAbsolute(withinRoot) || resolve(rootPath, withinRoot) !== directoryPath) throw new SessionPersistenceCorruptionError(`session "${id}": refusing to delete a directory outside the configured data root`, {});
		const quarantineRoot = join(this.root, ".quarantine");
		await mkdir(quarantineRoot, {
			recursive: true,
			mode: 448
		});
		const quarantined = join(quarantineRoot, `${encodeSegment(id)}-${randomBytes(12).toString("hex")}`);
		const lease = await this.acquireLease(id, void 0, directory);
		try {
			await rename(directory, quarantined);
		} finally {
			await lease.release();
		}
		await rm(quarantined, { recursive: true });
		return true;
	}
	/** Resolve and read one stored log, refusing loudly when the artifact is absent. */
	async requireStoredLog(id, signal) {
		const selected = await this.findLog(id, signal);
		if (selected === void 0) throw new SessionPersistenceNotFoundError(id);
		if (selected.sourceVersion < SESSION_FORMAT_VERSION) {
			const sourceRevision = fileRevision(await stat(selected.sourcePath, { bigint: true }));
			signal?.throwIfAborted();
			let preparation = this.migrationPreparations.get(id);
			if (preparation === void 0 || preparation.sourcePath !== selected.sourcePath || preparation.sourceRevision !== sourceRevision) {
				const controller = new AbortController();
				const promise = this.loadStoredMigration(id, selected, sourceRevision, controller.signal);
				preparation = {
					sourcePath: selected.sourcePath,
					sourceRevision,
					controller,
					promise,
					settled: false,
					waiters: 0
				};
				this.migrationPreparations.set(id, preparation);
				const created = preparation;
				const release = () => {
					created.settled = true;
					if (this.migrationPreparations.get(id) === created) this.migrationPreparations.delete(id);
				};
				promise.then(release, release);
			}
			signal?.throwIfAborted();
			return this.waitForPreparation(id, preparation, signal);
		}
		if (selected.sourceVersion > SESSION_FORMAT_VERSION) {
			/* v8 ignore else -- a readable future header is rejected inside readGenerationHeader. */
			if (await this.readGenerationHeader(selected, id, signal) === void 0) throw new SessionPersistenceCorruptionError(`session "${id}": stored log has a malformed header (raw log: ${selected.sourcePath})`, { cause: /* @__PURE__ */ new Error("malformed Session header") });
			/* v8 ignore next -- readGenerationHeader rejects every future version. */
			throw new SessionFormatUnsupportedError(`${sessionFormatVersionRefusal(id, selected.sourceVersion)} (raw log: ${selected.sourcePath})`, {
				kind: "jsonl",
				path: selected.sourcePath
			});
		}
		const probe = fileRevision(await stat(selected.sourcePath, { bigint: true }));
		const memoized = this.coldLogMemo.get(id);
		if (memoized?.status === "current" && memoized.revision === probe) {
			this.coldLogMemo.delete(id);
			this.coldLogMemo.set(id, memoized);
			return memoized;
		}
		const current = await readStableJsonlFile(selected.sourcePath, signal);
		return this.decodeStoredLog(selected.sourcePath, id, current.bytes, fileRevision(current.identity), signal);
	}
	/** Probe the memo and otherwise decode one historical generation under backend cancellation. */
	async loadStoredMigration(id, selected, sourceRevision, signal) {
		signal.throwIfAborted();
		const memoized = this.coldLogMemo.get(id);
		if (memoized?.status === "prepared" && memoized.revision === sourceRevision) {
			this.coldLogMemo.delete(id);
			this.coldLogMemo.set(id, memoized);
			return memoized;
		}
		return this.prepareStoredMigration(id, selected, signal);
	}
	/** Await shared preparation for one caller and abort it only after its last waiter leaves. */
	async waitForPreparation(id, preparation, signal) {
		preparation.waiters += 1;
		try {
			return await waitWithAbort(preparation.promise, signal);
		} finally {
			preparation.waiters -= 1;
			if (preparation.waiters === 0 && !preparation.settled) {
				/* v8 ignore else -- a newer selected source may already own this id's preparation slot. */
				if (this.migrationPreparations.get(id) === preparation) this.migrationPreparations.delete(id);
				preparation.controller.abort();
			}
		}
	}
	/** Decode one historical generation without publishing a successor. */
	async prepareStoredMigration(id, selected, signal) {
		let prepared;
		try {
			prepared = await prepareJsonlMigration({
				sourcePath: selected.sourcePath,
				sourceVersion: selected.sourceVersion,
				currentPath: selected.currentPath,
				compression: this.compression,
				format: this.generationFormat,
				verifyCurrentFile: verifyCurrentGenerationInWorker,
				validateHistoricalHeader: (headerValue) => this.validateSourceIdentity(selected, headerValue, id, signal),
				signal
			});
		} catch (error) {
			throw this.generationFailure(id, selected, error);
		}
		const meta = this.currentHeader(prepared.artifact.header);
		assertStoredId(id, meta);
		const events = prepared.artifact.events;
		validateStoredEvents(meta, events, {
			kind: "jsonl",
			path: selected.sourcePath
		});
		const stored = {
			status: "prepared",
			meta,
			...freezeStoredEvents(events),
			tornTruncateTo: void 0,
			recoveredTail: [],
			inheritedEventCount: SessionLogOffset(prepared.artifact.inheritedEventCount),
			revision: fileRevision(prepared.sourceIdentity),
			publication: {
				source: selected,
				value: prepared
			}
		};
		this.memoizeStoredLog(id, stored);
		return stored;
	}
	/** Publish a prepared historical log before granting write access. */
	async publishStoredMigration(id, stored) {
		const migration = stored.publication;
		let identity;
		try {
			identity = await migration.value.publish();
		} catch (error) {
			/* v8 ignore else -- a newer preparation may have replaced this stale cache entry. */
			if (this.coldLogMemo.get(id) === stored) this.coldLogMemo.delete(id);
			throw this.generationFailure(id, migration.source, error);
		}
		const published = {
			status: "current",
			meta: stored.meta,
			eventState: stored.eventState,
			events: stored.events,
			tornTruncateTo: stored.tornTruncateTo,
			recoveredTail: stored.recoveredTail,
			inheritedEventCount: stored.inheritedEventCount,
			revision: fileRevision(identity)
		};
		this.memoizeStoredLog(id, published);
		return published;
	}
	/** Translate generation-layer failures into the persistence seam's error vocabulary. */
	generationFailure(id, selected, error) {
		if (error instanceof JsonlGenerationUnsupportedMigrationError) return new SessionFormatUnsupportedError(`${error.message}; source v${error.fromVersion} artifact remains unchanged (raw log: ${selected.sourcePath})`, {
			kind: "jsonl",
			path: selected.sourcePath
		});
		if (error instanceof JsonlGenerationSourceChangedError) return error;
		if (error instanceof SessionFormatUnsupportedError || error instanceof SessionPersistenceCorruptionError || isErrnoException(error) || error instanceof DOMException && error.name === "AbortError") return error;
		return new SessionPersistenceCorruptionError(`session "${id}": stored log is corrupt: ${String(error)} (raw log: ${selected.sourcePath})`, { cause: error });
	}
	/**
	* Read, parse, and validate one stored log as the current logical prefix.
	* @param path - the artifact file to read.
	* @param expectedId - the session identity the artifact must carry.
	* @param signal - optional cancellation for the stat/read/decode work.
	* @returns the validated stored log with any torn-tail truncation point.
	*/
	async readStoredLog(path, expectedId, signal) {
		signal?.throwIfAborted();
		const probe = fileRevision(await stat(path, { bigint: true }));
		const memoized = this.coldLogMemo.get(expectedId);
		if (memoized?.status === "current" && memoized.revision === probe) {
			this.coldLogMemo.delete(expectedId);
			this.coldLogMemo.set(expectedId, memoized);
			return memoized;
		}
		const { bytes, identity } = await readStableJsonlFile(path, signal);
		return this.decodeStoredLog(path, expectedId, bytes, fileRevision(identity), signal);
	}
	/** Decode and memoize one already-stable current physical snapshot. */
	async decodeStoredLog(path, expectedId, buffer, revision, signal) {
		let parsed;
		try {
			if (this.compression === "zstd") parsed = await this.readZstdPrefix(buffer, signal);
			else {
				signal?.throwIfAborted();
				const { meta, inheritedEventCount, events, committedBytes } = scanLog(buffer);
				signal?.throwIfAborted();
				parsed = {
					meta,
					inheritedEventCount,
					events,
					tornTruncateTo: committedBytes < buffer.byteLength ? committedBytes : void 0,
					recoveredTail: []
				};
			}
		} catch (error) {
			signal?.throwIfAborted();
			if (error instanceof SessionFormatUnsupportedError) throw new SessionFormatUnsupportedError(`${error.message} (raw log: ${path})`, {
				kind: "jsonl",
				path
			});
			throw new SessionPersistenceCorruptionError(`session "${expectedId}": stored log is corrupt: ${String(error)} (raw log: ${path})`, { cause: error });
		}
		signal?.throwIfAborted();
		await this.assertStoredIdentity(path, SESSION_FORMAT_VERSION, parsed.meta, expectedId, signal);
		signal?.throwIfAborted();
		assertStoredId(expectedId, parsed.meta);
		const location = this.locate(parsed.meta);
		validateStoredEvents(parsed.meta, parsed.events, location);
		const { events, ...rest } = parsed;
		const stored = {
			status: "current",
			...rest,
			...freezeStoredEvents(events),
			revision
		};
		this.memoizeStoredLog(expectedId, stored);
		return stored;
	}
	/** Insert one parsed log into the bounded handoff cache. */
	memoizeStoredLog(id, stored) {
		this.coldLogMemo.delete(id);
		this.coldLogMemo.set(id, stored);
		for (const oldest of this.coldLogMemo.keys()) {
			if (this.coldLogMemo.size <= COLD_LOG_MEMO_MAX_ENTRIES) break;
			this.coldLogMemo.delete(oldest);
		}
	}
	/**
	* Resolve a session's current-generation log path.
	* @param id - the stored session to locate.
	* @param signal - optional cancellation for the directory scans.
	* @returns the current artifact path, or `undefined` while only a historical generation exists.
	*/
	async resolveCurrentLog(id, signal) {
		await this.ensureRootEncoding();
		signal?.throwIfAborted();
		const selected = await this.findLog(id, signal);
		if (selected === void 0) return void 0;
		if (selected.sourceVersion === SESSION_FORMAT_VERSION) return selected.sourcePath;
		if (selected.sourceVersion < SESSION_FORMAT_VERSION) return void 0;
		throw new SessionFormatUnsupportedError(`${sessionFormatVersionRefusal(id, selected.sourceVersion)} (raw log: ${selected.sourcePath})`, {
			kind: "jsonl",
			path: selected.sourcePath
		});
	}
	/**
	* Durably append one validated batch; lazily materializes on the first write.
	* @param header - the session's stored header.
	* @param events - the validated contiguous batch, in seq order.
	* @param isMaterialized - whether the session already has a durable artifact.
	* @param inheritedEventCount - the exact fork-inherited prefix length written into a materializing header line.
	*/
	async persistBatch(header, events, isMaterialized, inheritedEventCount) {
		this.coldLogMemo.delete(header.id);
		await this.ensureRootEncoding();
		if (isMaterialized) await this.appendLines(header, events);
		else {
			await this.materialize(header, inheritedEventCount, events);
			this.tracker.materialized(header.id);
		}
	}
	/**
	* Materialize a header-only artifact for an explicitly durable empty session.
	* @param header - the session's stored header.
	* @param inheritedEventCount - the exact fork-inherited prefix length written into the header line.
	*/
	async persistHeader(header, inheritedEventCount) {
		this.coldLogMemo.delete(header.id);
		await this.ensureRootEncoding();
		await this.materialize(header, inheritedEventCount, []);
		this.tracker.materialized(header.id);
	}
	/**
	* Truncate a torn physical tail durably before this session's first new append.
	* @param header - the session's stored header.
	* @param truncateTo - the byte offset the artifact is truncated to.
	*/
	async truncateTornTail(header, truncateTo) {
		this.coldLogMemo.delete(header.id);
		await this.repair(header, truncateTo);
		this.ctx.logger.warn(`${this.name}: session "${header.id}" recovered from a torn tail; incomplete tail bytes were discarded`);
	}
	/**
	* Whether this process still tracks a created-but-unmaterialized session.
	* @param id - the session to test.
	* @returns true while the pending entry exists.
	*/
	hasPendingSession(id) {
		return this.tracker.hasPending(id);
	}
	/**
	* Release one handle's backend bookkeeping on close.
	* @param handle - the closing handle.
	* @param materialized - whether the session reached durable storage.
	*/
	releaseHandle(handle, materialized) {
		this.tracker.release(handle, materialized);
	}
	/**
	* Acquire the session directory's kernel write lock; the kernel holds it
	* until the handle's close releases the descriptor, including on process death.
	* @param id - the session the lock guards.
	* @param cwd - header cwd used to derive the directory for a fresh session.
	* @param dir - the resolved directory of an existing artifact, when known.
	* @returns the held lock.
	*/
	acquireLease(id, cwd, dir = sessionDir(this.root, cwd, id)) {
		return SessionWriteLease.acquire(dir, id);
	}
	/**
	* Acquire the cross-process write lock for a materializing created session,
	* called by its handle immediately before the first log bytes publish.
	* @param header - the session's stored header (its cwd derives the directory).
	* @returns the held lock.
	*/
	async acquireWriteLease(header) {
		await this.rejectOppositeArtifact(header.cwd, header.id);
		return this.acquireLease(header.id, header.cwd);
	}
	/** Decode complete frames and retain complete JSONL records from a torn final frame. */
	async readZstdPrefix(buffer, signal) {
		signal?.throwIfAborted();
		const { frames, tornStart } = scanZstdFrames(buffer);
		signal?.throwIfAborted();
		if (frames.length === 0) throw new Error("empty or header-less Zstandard session log");
		const decoder = createZstdFrameDecoder();
		let yieldDeadline = performance.now() + ZSTD_DECODE_YIELD_INTERVAL_MS;
		try {
			const decodedFrames = decoder.decode(buffer, frames);
			signal?.throwIfAborted();
			const headerFrame = decodedFrames.next();
			signal?.throwIfAborted();
			/* v8 ignore next -- a non-empty structural frame list makes the decoder yield its first frame or throw. */
			if (headerFrame.done) throw new Error("empty or header-less Zstandard session log");
			assertZstdHeaderFrame(headerFrame.value);
			const scanner = new SessionLogScanner(headerFrame.value);
			let remainingFrames = frames.length - 1;
			for (const plaintext of decodedFrames) {
				signal?.throwIfAborted();
				scanner.write(plaintext);
				remainingFrames -= 1;
				if (remainingFrames > 0 && performance.now() >= yieldDeadline) {
					await scheduler.yield();
					signal?.throwIfAborted();
					yieldDeadline = performance.now() + ZSTD_DECODE_YIELD_INTERVAL_MS;
				}
			}
			signal?.throwIfAborted();
			const complete = scanner.checkpoint();
			if (complete.committedBytes !== complete.inputBytes) throw new Error("corrupt Zstandard session log: complete frame contains a torn JSONL record");
			if (tornStart === void 0) {
				const prefix = scanner.finish();
				return {
					meta: prefix.meta,
					inheritedEventCount: prefix.inheritedEventCount,
					events: prefix.events,
					tornTruncateTo: void 0,
					recoveredTail: []
				};
			}
			let recoveredPlaintext = Buffer.alloc(0);
			try {
				signal?.throwIfAborted();
				recoveredPlaintext = await decompressZstdPrefix(buffer.subarray(tornStart));
			} catch {
				/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
				if (signal?.aborted) signal.throwIfAborted();
			}
			signal?.throwIfAborted();
			scanner.write(recoveredPlaintext);
			const prefix = scanner.finish();
			return {
				meta: prefix.meta,
				inheritedEventCount: prefix.inheritedEventCount,
				events: prefix.events,
				tornTruncateTo: tornStart,
				recoveredTail: prefix.events.slice(complete.eventCount)
			};
		} catch (error) {
			/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
			if (signal?.aborted) signal.throwIfAborted();
			throw error;
		} finally {
			decoder.close();
		}
	}
	async listArtifacts(signal) {
		signal?.throwIfAborted();
		await this.ensureRootEncoding();
		signal?.throwIfAborted();
		const artifacts = [];
		const ids = /* @__PURE__ */ new Set();
		for (const project of await this.listProjectDirs(signal)) {
			signal?.throwIfAborted();
			for (const dir of await this.listSessionDirs(project, signal)) {
				signal?.throwIfAborted();
				const selected = await this.resolveGenerationInDirectory(dir, signal);
				if (selected === void 0) continue;
				let header;
				try {
					header = await this.readGenerationHeader(selected, void 0, signal);
				} catch (error) {
					if (error instanceof SessionFormatUnsupportedError) continue;
					throw error;
				}
				if (header === void 0) continue;
				if (ids.has(header.id)) throw new Error(`duplicate JSONL session id "${header.id}" appears in multiple project directories`);
				ids.add(header.id);
				artifacts.push({
					header,
					path: selected.sourcePath
				});
			}
		}
		signal?.throwIfAborted();
		return artifacts;
	}
	/** Read and translate one selected generation header without inspecting its body. */
	async readGenerationHeader(selected, expectedId, signal) {
		let first;
		try {
			first = this.compression === "zstd" ? await this.readFirstZstdLine(selected.sourcePath, signal) : await this.readFirstLine(selected.sourcePath, signal);
		} catch (error) {
			signal?.throwIfAborted();
			if (isENOENT(error)) return void 0;
			throw error;
		}
		signal?.throwIfAborted();
		if (first === void 0) return void 0;
		let value;
		try {
			value = JSON.parse(first);
		} catch {
			return;
		}
		assertNoRetiredHeaderFields(value);
		const result = sessionFormatCatalog.readHeader(value);
		if ("storedVersion" in result && result.storedVersion !== selected.sourceVersion) throw new Error(`session generation filename identifies v${selected.sourceVersion}, but its header identifies v${result.storedVersion}`);
		if (result.status === "unsupported") {
			const physicalId = String(value.id);
			let reason = result.reason;
			/* v8 ignore else -- released historical header migrations cannot refuse after physical decoding. */
			if (result.storedVersion > SESSION_FORMAT_VERSION) reason = sessionFormatVersionRefusal(physicalId, result.storedVersion);
			throw new SessionFormatUnsupportedError(`${reason} (raw log: ${selected.sourcePath})`, {
				kind: "jsonl",
				path: selected.sourcePath
			});
		}
		if (result.status === "malformed") return void 0;
		const header = this.currentHeader(result.header);
		await this.assertStoredIdentity(selected.sourcePath, selected.sourceVersion, header, expectedId, signal);
		return header;
	}
	/** Convert format-catalog string identities to current branded Session metadata. */
	currentHeader(header) {
		/* v8 ignore next 3 -- readable catalog results are restored to its configured current version. */
		if (header.version !== SESSION_FORMAT_VERSION) throw new Error(`format catalog returned non-current logical header v${header.version}`);
		return {
			version: SESSION_FORMAT_VERSION,
			id: SessionId(header.id),
			createdAt: header.createdAt,
			...header.cwd === void 0 ? {} : { cwd: header.cwd },
			...header.parentSession === void 0 ? {} : { parentSession: SessionId(header.parentSession) },
			isSeeded: header.isSeeded,
			...header.origin === void 0 ? {} : { origin: header.origin },
			delegationDepth: header.delegationDepth,
			...header.agentPreset === void 0 ? {} : { agentPreset: header.agentPreset }
		};
	}
	/** Atomically write the header line + first batch (temp-write, fsync, publish). */
	async materialize(meta, inheritedEventCount, events) {
		const project = projectDir(this.root, meta.cwd);
		const dir = sessionDir(this.root, meta.cwd, meta.id);
		const finalPath = logPath(this.root, meta.cwd, meta.id, this.compression);
		await this.rejectOppositeArtifact(meta.cwd, meta.id);
		const content = await this.encodeMaterialization(meta, inheritedEventCount, events);
		/* v8 ignore next -- native Windows coverage exercises this platform dispatch; Linux covers the POSIX peer */
		if (process.platform === "win32") await this.materializeWin32(project, dir, finalPath, meta.id, content);
		else await this.materializePosix(project, dir, finalPath, meta.id, content);
	}
	/* v8 ignore start -- Windows uses the Win32 durable-publish path; POSIX coverage exercises this peer. */
	async materializePosix(project, dir, finalPath, id, content) {
		await mkdir(this.root, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(dirname(this.root));
		await mkdir(project, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(this.root);
		await mkdir(dir, {
			recursive: true,
			mode: 448
		});
		await this.syncDirPosix(project);
		await this.rejectExistingLog(finalPath, id);
		const tmp = await this.writeSyncedTempFile(finalPath, content);
		let linked = false;
		try {
			await link(tmp, finalPath);
			linked = true;
		} finally {
			/* v8 ignore next -- link failure is the TOCTOU/IO race guarded above; not reachable in test */
			if (!linked) await rm(tmp, { force: true });
		}
		await this.syncDirPosix(dir);
		try {
			await rm(tmp, { force: true });
		} catch {}
	}
	/* v8 ignore stop */
	/* v8 ignore start -- native Windows coverage exercises this integration path */
	async materializeWin32(project, dir, finalPath, id, content) {
		await ensureDurableDirectoryWin32(this.root);
		await ensureDurableDirectoryWin32(project);
		await ensureDurableDirectoryWin32(dir);
		await this.rejectExistingLog(finalPath, id);
		const tmp = await this.writeSyncedTempFile(finalPath, content);
		try {
			await publishNewFileWin32(tmp, finalPath);
		} catch (error) {
			await rm(tmp, { force: true });
			throw error;
		}
	}
	/* v8 ignore stop */
	async rejectExistingLog(finalPath, id) {
		/* v8 ignore next 3 -- create guards collisions before materialize; this is a TOCTOU backstop */
		if (await this.resolveGenerationInDirectory(dirname(finalPath)) !== void 0) throw new Error(`refusing to materialize "${id}": a log already exists on disk (open it instead)`);
	}
	async writeSyncedTempFile(finalPath, content) {
		const tmp = `${finalPath}.${randomBytes(6).toString("hex")}.tmp`;
		const handle = await open(tmp, "wx", 384);
		try {
			await handle.writeFile(content);
			await handle.sync();
		} finally {
			await handle.close();
		}
		return tmp;
	}
	/** Encode the header and first batch without combining their frame boundaries. */
	async encodeMaterialization(meta, inheritedEventCount, events) {
		const header = JSON.stringify(toHeaderLine(meta, meta.isSeeded ? inheritedEventCount : void 0)) + "\n";
		if (events.length === 0) return this.compression === "none" ? header : compressZstdFrame(header);
		const body = eventLines(events) + "\n";
		if (this.compression === "none") return header + body;
		const headerFrame = await compressZstdFrame(header);
		const eventFrame = await compressZstdFrame(body);
		return Buffer.concat([headerFrame, eventFrame]);
	}
	/** Encode one durable append batch in the configured physical representation. */
	async encodeEventBatch(events) {
		const body = eventLines(events) + "\n";
		return this.compression === "zstd" ? compressZstdFrame(body) : body;
	}
	/** fsync a POSIX directory so a just-created/renamed entry is crash-durable. */
	/* v8 ignore start -- Windows uses write-through namespace operations; POSIX coverage exercises directory fsync. */
	async syncDirPosix(dir) {
		const handle = await open(dir, "r");
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/* v8 ignore stop */
	/**
	* Append and fsync event lines. On a partial write or sync failure, restore the
	* previous size before rethrowing because the unchanged cursor will retry the
	* batch; leaving partial bytes would create duplicate sequence numbers.
	*/
	async appendLines(meta, events) {
		const content = await this.encodeEventBatch(events);
		const path = logPath(this.root, meta.cwd, meta.id, this.compression);
		const handle = await open(path, "a");
		let closed = false;
		const closeAppendHandle = async () => {
			if (closed) return;
			closed = true;
			await handle.close();
		};
		try {
			const { size: before } = await handle.stat();
			try {
				await handle.writeFile(content);
				await handle.sync();
			} catch (error) {
				try {
					await closeAppendHandle();
					await this.rollbackAppend(path, before);
				} catch (rollbackError) {
					throw new AggregateError([error, rollbackError], `failed to roll back append to "${path}"`);
				}
				throw error;
			}
		} finally {
			await closeAppendHandle();
		}
	}
	async rollbackAppend(path, size) {
		const handle = await open(path, "r+");
		try {
			await handle.truncate(size);
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/** Truncate the log file to `offset` bytes and fsync (discard the crash tail). */
	async repair(meta, offset) {
		const path = logPath(this.root, meta.cwd, meta.id, this.compression);
		await truncate(path, offset);
		const handle = await open(path, "r+");
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	}
	/**
	* Read the first newline-terminated line of a file without loading the whole
	* file. Returns undefined if the file is empty or has no complete first line.
	* Reads in bounded chunks so a huge log costs only the header read.
	*/
	async readFirstLine(path, signal) {
		signal?.throwIfAborted();
		const handle = await open(path, "r");
		try {
			signal?.throwIfAborted();
			const chunks = [];
			const buf = Buffer.alloc(8192);
			for (;;) {
				signal?.throwIfAborted();
				const { bytesRead } = await handle.read(buf, 0, buf.length, null);
				signal?.throwIfAborted();
				if (bytesRead === 0) return void 0;
				const slice = buf.subarray(0, bytesRead);
				const nl = slice.indexOf(10);
				if (nl !== -1) {
					chunks.push(slice.subarray(0, nl));
					signal?.throwIfAborted();
					return Buffer.concat(chunks).toString("utf8");
				}
				chunks.push(Buffer.from(slice));
			}
		} finally {
			await handle.close();
		}
	}
	/** Read and validate only the independently compressed header frame. */
	async readFirstZstdLine(path, signal) {
		signal?.throwIfAborted();
		const handle = await open(path, "r");
		try {
			signal?.throwIfAborted();
			let content = Buffer.alloc(0);
			const chunk = Buffer.alloc(8192);
			for (;;) {
				signal?.throwIfAborted();
				const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
				signal?.throwIfAborted();
				if (bytesRead === 0) return void 0;
				signal?.throwIfAborted();
				content = Buffer.concat([content, chunk.subarray(0, bytesRead)]);
				signal?.throwIfAborted();
				const first = scanZstdFrames(content, 1).frames[0];
				signal?.throwIfAborted();
				if (first === void 0) continue;
				let plaintext;
				try {
					signal?.throwIfAborted();
					plaintext = await decompressZstdFrame(content.subarray(first.start, first.end));
				} catch (error) {
					/* v8 ignore next -- decoder failure plus concurrent abort is timing-dependent */
					if (signal?.aborted) signal.throwIfAborted();
					throw new Error("corrupt Zstandard session log: header frame failed validation", { cause: error });
				}
				signal?.throwIfAborted();
				assertZstdHeaderFrame(plaintext);
				return plaintext.subarray(0, -1).toString("utf8");
			}
		} finally {
			await handle.close();
		}
	}
	/** Select the numerically highest canonical generation in one Session directory. */
	async resolveGenerationInDirectory(dir, signal) {
		signal?.throwIfAborted();
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		signal?.throwIfAborted();
		const generations = [];
		const opposite = [];
		for (const entry of entries) {
			const version = parseGenerationLogFilename(entry.name, this.compression);
			if (version !== void 0) {
				generations.push({
					path: join(dir, entry.name),
					version
				});
				continue;
			}
			if (parseGenerationLogFilename(entry.name, this.oppositeCompression()) !== void 0) opposite.push(join(dir, entry.name));
		}
		if (opposite.length > 0) throw this.encodingMismatch(opposite[0]);
		const latest = generations.sort((left, right) => right.version - left.version)[0];
		if (latest === void 0) return void 0;
		return {
			sourcePath: latest.path,
			sourceVersion: latest.version,
			currentPath: join(dir, generationLogFilename(sessionFormatCatalog.currentVersion, this.compression))
		};
	}
	/** Find the unique authoritative generation for an id across project directories. */
	async findLog(id, signal) {
		const matches = [];
		for (const project of await this.listProjectDirs(signal)) {
			signal?.throwIfAborted();
			await this.rejectLegacyFlatArtifact(project, id, signal);
			signal?.throwIfAborted();
			const dir = join(project, encodeSegment(id));
			const selected = await this.resolveGenerationInDirectory(dir, signal);
			if (selected !== void 0) matches.push(selected);
		}
		if (matches.length > 1) throw new Error(`duplicate JSONL session id "${id}" appears in multiple project directories`);
		signal?.throwIfAborted();
		return matches[0];
	}
	/** Require an existing configured root to be a readable directory. */
	assertUsableRoot() {
		try {
			readdirSync(this.root);
		} catch (error) {
			if (isENOENT(error)) return;
			throw error;
		}
	}
	/** Reject metadata that does not identify the selected physical log. */
	async assertStoredIdentity(path, storedVersion, meta, expectedId, signal) {
		signal?.throwIfAborted();
		if (expectedId !== void 0 && meta.id !== expectedId) throw new Error(`corrupt session log "${path}": requested id "${expectedId}" does not match header id "${meta.id}"`);
		let expectedPath;
		try {
			expectedPath = generationLogPath(this.root, meta.cwd, meta.id, storedVersion, this.compression);
		} catch (error) {
			throw new Error(`corrupt session log "${path}": header id cannot name a storage path`, { cause: error });
		}
		if (path !== expectedPath && !await this.sameFile(path, expectedPath, signal)) throw new Error(`corrupt session log "${path}": header id "${meta.id}" and cwd identify "${expectedPath}"`);
		signal?.throwIfAborted();
	}
	/** Validate a supported historical header against the selected source path. */
	validateSourceIdentity(selected, headerValue, expectedId, signal) {
		const result = sessionFormatCatalog.readHeader(headerValue);
		if (result.status !== "current" && result.status !== "migration-required") return;
		return this.assertStoredIdentity(selected.sourcePath, selected.sourceVersion, this.currentHeader(result.header), expectedId, signal);
	}
	/**
	* Whether two path spellings resolve to the same physical file. This admits
	* case aliases on case-insensitive filesystems without weakening identity
	* checks on case-sensitive stores.
	*/
	async sameFile(path, expectedPath, signal) {
		signal?.throwIfAborted();
		try {
			const [actual, expected] = await Promise.all([realpath(path), realpath(expectedPath)]);
			signal?.throwIfAborted();
			return actual === expected;
		} catch (error) {
			signal?.throwIfAborted();
			/* v8 ignore else -- non-ENOENT realpath failures require an external permission or I/O fault */
			if (isENOENT(error)) return false;
			/* v8 ignore next -- non-ENOENT realpath failures are external I/O faults, propagated unchanged */
			throw error;
		}
	}
	/** The human-readable project directories under the configured root. */
	async listProjectDirs(signal) {
		try {
			signal?.throwIfAborted();
			const entries = await readdir(this.root, { withFileTypes: true });
			signal?.throwIfAborted();
			return entries.filter((e) => e.isDirectory() && e.name !== ".quarantine").map((e) => join(this.root, e.name));
		} catch (error) {
			if (isENOENT(error)) return [];
			throw error;
		}
	}
	/** List session-owned directories and reject the obsolete flat-file layout. */
	async listSessionDirs(project, signal) {
		signal?.throwIfAborted();
		const entries = await readdir(project, { withFileTypes: true });
		signal?.throwIfAborted();
		const legacy = entries.find((entry) => entry.isFile() && (entry.name.endsWith(".jsonl") || entry.name.endsWith(".jsonl.zstd")));
		if (legacy !== void 0) throw this.legacyLayout(join(project, legacy.name));
		return entries.filter((entry) => entry.isDirectory()).map((entry) => join(project, entry.name));
	}
	/** Reject a root that already belongs to the other physical encoding. */
	ensureRootEncoding() {
		this.rootEncodingCheck ??= this.checkRootEncoding();
		return this.rootEncodingCheck;
	}
	async checkRootEncoding() {
		for (const project of await this.listProjectDirs()) for (const dir of await this.listSessionDirs(project)) {
			const incompatible = await this.findOppositeGenerationInDirectory(dir);
			if (incompatible !== void 0) throw this.encodingMismatch(incompatible);
		}
	}
	async rejectLegacyFlatArtifact(project, id, signal) {
		signal?.throwIfAborted();
		const encoded = encodeSegment(id);
		for (const compression of ["zstd", "none"]) {
			const path = join(project, encoded + logSuffix(compression));
			const artifactExists = await this.exists(path);
			signal?.throwIfAborted();
			if (artifactExists) throw this.legacyLayout(path);
		}
	}
	async rejectOppositeArtifact(cwd, id) {
		const path = await this.findOppositeGenerationInDirectory(sessionDir(this.root, cwd, id));
		if (path !== void 0) throw this.encodingMismatch(path);
	}
	/** Return the highest canonical generation encoded with the other configured suffix. */
	async findOppositeGenerationInDirectory(dir) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (isENOENT(error)) return void 0;
			throw error;
		}
		const generations = [];
		for (const entry of entries) {
			const version = parseGenerationLogFilename(entry.name, this.oppositeCompression());
			if (version !== void 0) generations.push({
				name: entry.name,
				version
			});
		}
		const latest = generations.sort((left, right) => right.version - left.version)[0];
		return latest === void 0 ? void 0 : join(dir, latest.name);
	}
	oppositeCompression() {
		return this.compression === "zstd" ? "none" : "zstd";
	}
	encodingMismatch(path) {
		return /* @__PURE__ */ new Error(`session artifact ${JSON.stringify(path)} uses ${logSuffix(this.oppositeCompression())}, but this backend is configured for compression ${JSON.stringify(this.compression)}; use a separate root or select the matching compression mode`);
	}
	legacyLayout(path) {
		return /* @__PURE__ */ new Error(`session artifact ${JSON.stringify(path)} uses the unsupported flat-file layout; use a separate root or move it into a project/session directory before loading`);
	}
	async exists(path) {
		try {
			await (await open(path, "r")).close();
			return true;
		} catch (error) {
			/* v8 ignore else -- Windows reports file-valued parents as ENOENT; POSIX covers direct ENOTDIR. */
			if (isENOENT(error)) {
				/* v8 ignore next -- native Windows coverage exercises this platform dispatch; POSIX reports ENOTDIR from open */
				if (process.platform === "win32") await this.assertLogParentAllowsAbsence(path);
				return false;
			}
			/* v8 ignore next -- Windows repairs ENOTDIR from ENOENT above; POSIX covers direct ENOTDIR. */
			throw error;
		}
	}
	/* v8 ignore start -- native Windows coverage exercises this repair; POSIX open reports ENOTDIR before this point. */
	async assertLogParentAllowsAbsence(path) {
		try {
			const parent = dirname(path);
			if ((await stat(parent)).isDirectory()) return;
			const error = /* @__PURE__ */ new Error(`ENOTDIR: parent path exists but is not a directory: ${parent}`);
			error.code = "ENOTDIR";
			error.path = parent;
			throw error;
		} catch (error) {
			if (isENOENT(error)) return;
			throw error;
		}
	}
};
//#endregion
export { JsonlCompressionSchema, JsonlSessionPersistence as default };
