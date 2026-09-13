import { homedir } from "node:os";
import { Deque } from "@deepseek-ai/dsh-deque";
import { carrierKeyOf } from "@deepseek-ai/dsh-scope";
import { isJsonValue } from "@deepseek-ai/dsh-util-values";
//#region src/remote-events.ts
/**
* Host events this application forwards without renaming. The explicit mode is
* both the Host dispatch strategy and the legal key set of `ctx.remote.$on`.
*/
const API_REMOTE_FORWARDED_EVENTS = [
	{
		event: "agent-preset/selected",
		mode: "emit"
	},
	{
		event: "approval/request",
		mode: "waterfall"
	},
	{
		event: "api-session/activity",
		mode: "emit"
	},
	{
		event: "api-session/added",
		mode: "emit"
	},
	{
		event: "api-session/error",
		mode: "emit"
	},
	{
		event: "api-session/removed",
		mode: "emit"
	},
	{
		event: "api-session/status",
		mode: "emit"
	},
	{
		event: "commands/change",
		mode: "emit"
	},
	{
		event: "credentials/reference-updated",
		mode: "emit"
	},
	{
		event: "goal/activation-changed",
		mode: "emit"
	},
	{
		event: "cordis/request-run",
		mode: "emit"
	},
	{
		event: "cordis/request-run-resolved",
		mode: "emit"
	},
	{
		event: "cordis/dynamic-package",
		mode: "emit"
	},
	{
		event: "cordis/dynamic-retract",
		mode: "emit"
	},
	{
		event: "cordis/inspect-query",
		mode: "emit"
	},
	{
		event: "cordis/inspect-query-resolved",
		mode: "emit"
	},
	{
		event: "llm/adapters-updated",
		mode: "emit"
	},
	{
		event: "settings/document-updated",
		mode: "emit"
	},
	{
		event: "user-questions/request",
		mode: "waterfall"
	}
];
//#endregion
//#region src/index.ts
/** Host BFF entry and Loader shell for the Remote contribution assembly. */
/** Required Host services: the Gateway transport and SOC request identity. */
const inject = ["typertGateway", "socAuth"];
/** Host plugin body registering this application's selected Cordis event source. */
function apply(ctx) {
	ctx.effect(() => ctx.typertGateway.registerRemoteEvents(remoteEventSource(ctx), { home: homedir() }), "api-remotes: forwarded Cordis event source");
}
/** Create the sole queue and listener set consumed by the registered Gateway. */
function remoteEventSource(ctx) {
	return (signal) => {
		const queue = new RemoteEventQueue();
		const disposers = API_REMOTE_FORWARDED_EVENTS.map(({ event, mode }) => {
			if (mode === "emit") return ctx.on(event, ((...args) => {
				const jsonArgs = assertJsonArgs(event, args);
				const sessionId = scopedSessionId(event, jsonArgs);
				if (sessionId === void 0) {
					queue.push({
						event,
						args: jsonArgs
					});
					return;
				}
				const auth = ctx.get("socAuth");
				Promise.resolve(auth.principalForHarnessSession(sessionId)).then((principal) => {
					if (principal !== void 0) queue.push({
						event,
						args: jsonArgs,
						principal
					});
				});
			}));
			return ctx.on(event, (function(request, next) {
				const carrierAgent = carrierKeyOf(this);
				if (carrierAgent === void 0) return next();
				const agent = request.agent;
				if (agent === void 0 || agent !== carrierAgent) throw new TypeError(`forwarded scoped event ${JSON.stringify(event)} must carry its Agent directly`);
				const auth = ctx.get("socAuth");
				const forward = (principal) => {
					if (principal === void 0) return next();
					const toolName = event === "approval/request" && typeof Reflect.get(request, "toolName") === "string" ? Reflect.get(request, "toolName") : void 0;
					if (toolName !== void 0 && auth.hasRememberedToolApproval(principal, agent.id, toolName)) return Promise.resolve("allowed-once");
					return forwardWaterfall(queue, event, request, {
						value: agent.ctx,
						subject: agent,
						agentId: agent.id,
						principal
					}, next, toolName === void 0 ? void 0 : (value) => normalizeApprovalResult(auth, principal, agent.id, toolName, value));
				};
				const principal = auth.principalForAgent(agent);
				return isPromiseLike(principal) ? Promise.resolve(principal).then(forward) : forward(principal);
			}));
		});
		return queue.iterate(signal, () => {
			for (const dispose of disposers) dispose();
		});
	};
}
/** One pull-driven queue bridging synchronous Cordis listeners to an AsyncIterable. */
var RemoteEventQueue = class {
	buffer = new Deque();
	waiter;
	done = false;
	push(frame) {
		if (this.done) return false;
		this.buffer.pushBack(frame);
		this.waiter?.();
		return true;
	}
	end(reason) {
		if (this.done) return;
		this.done = true;
		while (this.buffer.size > 0) {
			const dispatch = this.buffer.popFront();
			if ("context" in dispatch) dispatch.reject(reason);
		}
		this.waiter?.();
	}
	async *iterate(signal, cleanup) {
		const abort = () => {
			this.end(remoteEventSourceEndReason(signal));
		};
		signal.addEventListener("abort", abort, { once: true });
		try {
			while (true) {
				if (this.done || signal.aborted) return;
				while (this.buffer.size > 0) yield this.buffer.popFront();
				await new Promise((resolve) => {
					this.waiter = resolve;
				});
				this.waiter = void 0;
			}
		} finally {
			signal.removeEventListener("abort", abort);
			this.end(remoteEventSourceEndReason(signal));
			cleanup();
		}
	}
};
/**
* Normalize an event-source shutdown for pending Host waterfalls.
* @param signal - source lifetime whose reason wins after cancellation.
* @returns the cancellation reason or an unexpected-end failure.
*/
function remoteEventSourceEndReason(signal) {
	if (signal.aborted) return signal.reason;
	return /* @__PURE__ */ new Error("api-remotes: forwarded Remote event source ended");
}
/** Bridge one Cordis waterfall listener through the Gateway-owned pending event. */
function forwardWaterfall(queue, event, request, context, next, normalizeResult) {
	const settled = Promise.withResolvers();
	const dispatch = {
		event,
		request,
		context,
		resolve: (outcome) => {
			if (outcome.kind === "result") {
				settled.resolve(normalizeResult?.(outcome.value) ?? outcome.value);
				return;
			}
			Promise.resolve().then(next).then(settled.resolve, settled.reject);
		},
		reject: settled.reject
	};
	if (!queue.push(dispatch)) Promise.resolve().then(next).then(settled.resolve, settled.reject);
	return settled.promise;
}
function normalizeApprovalResult(auth, principal, sessionId, toolName, value) {
	if (typeof value !== "object" || value === null || Reflect.ownKeys(value).length !== 2 || Reflect.get(value, "outcome") !== "allowed-once" || Reflect.get(value, "remember") !== "tool") return value;
	return auth.rememberToolApproval(principal, sessionId, toolName) ? "allowed-once" : "unavailable";
}
/** Reject an allowlisted event whose runtime arguments are not lossless JSON data. */
function assertJsonArgs(event, args) {
	for (const [index, arg] of args.entries()) if (!isJsonValue(arg)) throw new Error(`forwarded host event "${event}" argument ${String(index)} is not lossless JSON data`);
	return args;
}
function scopedSessionId(event, args) {
	if (event === "agent-preset/selected" || event === "api-session/activity" || event === "api-session/removed" || event === "api-session/status" || event === "api-session/error") return typeof args[0] === "string" && args[0].length > 0 ? args[0] : void 0;
	if (event === "api-session/added") {
		const summary = args[0];
		return typeof summary === "object" && summary !== null && !Array.isArray(summary) && typeof summary.id === "string" && summary.id.length > 0 ? summary.id : void 0;
	}
	if (event === "goal/activation-changed") {
		const payload = args[0];
		return typeof payload === "object" && payload !== null && !Array.isArray(payload) && typeof payload.sessionId === "string" && payload.sessionId.length > 0 ? payload.sessionId : void 0;
	}
}
function isPromiseLike(value) {
	return (typeof value === "object" || typeof value === "function") && value !== null && typeof Reflect.get(value, "then") === "function";
}
//#endregion
export { API_REMOTE_FORWARDED_EVENTS, apply, inject };
