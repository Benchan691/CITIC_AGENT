/** Host BFF entry and Loader shell for the Remote contribution assembly. */

import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from 'dsh-soc-agent-agent'
import type { SocPrincipal } from 'dsh-soc-agent-connection'
import type {
  TypertRemoteEventDispatch,
  TypertRemoteEventInvocation,
  TypertRemoteEventOutcome,
  TypertRemoteEventSource,
} from 'dsh-soc-agent-api-gateway'
import { Deque } from '@deepseek-ai/dsh-deque'
import { carrierKeyOf } from '@deepseek-ai/dsh-scope'
import { isJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'
import { API_REMOTE_FORWARDED_EVENTS } from './remote-events.ts'

// The owner packages' client-safe `./types` exports carry the cordis `Events`
// declarations for every allowlisted event. Pulling them into this face is what
// makes the shape assertion below judge real signatures rather than an empty
// event vocabulary.
import type {} from '@deepseek-ai/dsh-commands/types'
import type {} from '@deepseek-ai/dsh-cordis-host-runner/types'
import type {} from '@deepseek-ai/dsh-credentials/types'
import type {} from '@deepseek-ai/dsh-goal/types'
import type {} from '@deepseek-ai/dsh-llm/types'
import type {} from '@deepseek-ai/dsh-agent-presets/types'
import type {} from '@deepseek-ai/dsh-settings/types'
import type {} from '@deepseek-ai/dsh-user-approval'
import type {} from '@deepseek-ai/dsh-user-questions'
export type {} from 'dsh-soc-agent-session-controller/types'

export { API_REMOTE_FORWARDED_EVENTS } from './remote-events.ts'
export type { ApiRemoteForwardedEvent } from './types.ts'

interface SocRemoteEventAuth {
  principalForAgent(agent: Agent):
    | Extract<SocPrincipal, { readonly kind: 'user' }>
    | undefined
    | Promise<Extract<SocPrincipal, { readonly kind: 'user' }> | undefined>
  principalForHarnessSession(sessionId: string):
    | Extract<SocPrincipal, { readonly kind: 'user' }>
    | undefined
    | Promise<Extract<SocPrincipal, { readonly kind: 'user' }> | undefined>
  hasRememberedToolApproval(
    principal: Extract<SocPrincipal, { readonly kind: 'user' }>,
    sessionId: string,
    toolName: string,
  ): boolean
  rememberToolApproval(
    principal: Extract<SocPrincipal, { readonly kind: 'user' }>,
    sessionId: string,
    toolName: string,
  ): boolean
}

/** Required Host services: the Gateway transport and SOC request identity. */
export const inject = ['typertGateway', 'socAuth']

/** Host plugin body registering this application's selected Cordis event source. */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.typertGateway.registerRemoteEvents(remoteEventSource(ctx), { home: homedir() }),
    'api-remotes: forwarded Cordis event source',
  )
}

/** Create the sole queue and listener set consumed by the registered Gateway. */
function remoteEventSource(ctx: Context): TypertRemoteEventSource {
  return (signal) => {
    const queue = new RemoteEventQueue()
    const disposers = API_REMOTE_FORWARDED_EVENTS.map(({ event, mode }) => {
      if (mode === 'emit') {
        return ctx.on(event as never, ((...args: unknown[]) => {
          const jsonArgs = assertJsonArgs(event, args)
          const sessionId = scopedSessionId(event, jsonArgs)
          if (sessionId === undefined) {
            queue.push({ event, args: jsonArgs })
            return
          }
          const auth = ctx.get('socAuth') as unknown as SocRemoteEventAuth
          void Promise.resolve(auth.principalForHarnessSession(sessionId)).then((principal) => {
            // A sensitive notification without a live authenticated owner is
            // intentionally dropped. The next authorized snapshot reconciles
            // the browser without disclosing the session to another client.
            if (principal !== undefined) queue.push({ event, args: jsonArgs, principal })
          })
        }) as never)
      }
      return ctx.on(event as never, (function (
        this: unknown,
        request: object,
        next: () => unknown,
      ) {
        const carrierAgent = carrierKeyOf(this)
        if (carrierAgent === undefined) return next()
        const agent = (request as { readonly agent?: Agent }).agent
        if (agent === undefined || agent !== carrierAgent) {
          throw new TypeError(`forwarded scoped event ${JSON.stringify(event)} must carry its Agent directly`)
        }
        const auth = ctx.get('socAuth') as unknown as SocRemoteEventAuth
        const forward = (principal: Extract<SocPrincipal, { readonly kind: 'user' }> | undefined) => {
          // An Agent without a current authenticated owner must never be
          // exposed to an arbitrary connected browser.
          if (principal === undefined) return next()
          const toolName = event === 'approval/request'
            && typeof Reflect.get(request, 'toolName') === 'string'
            ? Reflect.get(request, 'toolName') as string
            : undefined
          if (toolName !== undefined
            && auth.hasRememberedToolApproval(principal, agent.id, toolName)) {
            return Promise.resolve('allowed-once')
          }
          return forwardWaterfall(
            queue,
            event,
            request,
            { value: agent.ctx, subject: agent, agentId: agent.id, principal },
            next,
            toolName === undefined
              ? undefined
              : value => normalizeApprovalResult(auth, principal, agent.id, toolName, value),
          )
        }
        const principal = auth.principalForAgent(agent)
        return isPromiseLike(principal) ? Promise.resolve(principal).then(forward) : forward(principal)
      }) as never)
    })
    return queue.iterate(signal, () => {
      for (const dispose of disposers) dispose()
    })
  }
}

/** One pull-driven queue bridging synchronous Cordis listeners to an AsyncIterable. */
class RemoteEventQueue {
  private readonly buffer = new Deque<TypertRemoteEventDispatch>()
  private waiter: (() => void) | undefined
  private done = false

  push(frame: TypertRemoteEventDispatch): boolean {
    if (this.done) return false
    this.buffer.pushBack(frame)
    this.waiter?.()
    return true
  }

  private end(reason: unknown): void {
    if (this.done) return
    this.done = true
    while (this.buffer.size > 0) {
      const dispatch = this.buffer.popFront() as TypertRemoteEventDispatch
      if ('context' in dispatch) dispatch.reject(reason)
    }
    this.waiter?.()
  }

  async *iterate(signal: AbortSignal, cleanup: () => void): AsyncGenerator<TypertRemoteEventDispatch> {
    const abort = (): void => { this.end(remoteEventSourceEndReason(signal)) }
    signal.addEventListener('abort', abort, { once: true })
    try {
      while (true) {
        if (this.done || signal.aborted) return
        while (this.buffer.size > 0) yield this.buffer.popFront() as TypertRemoteEventDispatch
        await new Promise<void>((resolve) => { this.waiter = resolve })
        this.waiter = undefined
      }
    } finally {
      signal.removeEventListener('abort', abort)
      this.end(remoteEventSourceEndReason(signal))
      cleanup()
    }
  }
}

/**
 * Normalize an event-source shutdown for pending Host waterfalls.
 * @param signal - source lifetime whose reason wins after cancellation.
 * @returns the cancellation reason or an unexpected-end failure.
 */
function remoteEventSourceEndReason(signal: AbortSignal): unknown {
  if (signal.aborted) return signal.reason
  return new Error('api-remotes: forwarded Remote event source ended')
}

/** Bridge one Cordis waterfall listener through the Gateway-owned pending event. */
function forwardWaterfall(
  queue: RemoteEventQueue,
  event: string,
  request: object,
  context: TypertRemoteEventInvocation['context'],
  next: () => unknown,
  normalizeResult?: (value: unknown) => unknown,
): Promise<unknown> {
  const settled = Promise.withResolvers<unknown>()
  const dispatch: TypertRemoteEventInvocation = {
    event,
    request,
    context,
    resolve: (outcome: TypertRemoteEventOutcome) => {
      if (outcome.kind === 'result') {
        settled.resolve(normalizeResult?.(outcome.value) ?? outcome.value)
        return
      }
      void Promise.resolve().then(next).then(settled.resolve, settled.reject)
    },
    reject: settled.reject,
  }
  if (!queue.push(dispatch)) void Promise.resolve().then(next).then(settled.resolve, settled.reject)
  return settled.promise
}

function normalizeApprovalResult(
  auth: SocRemoteEventAuth,
  principal: Extract<SocPrincipal, { readonly kind: 'user' }>,
  sessionId: string,
  toolName: string,
  value: unknown,
): unknown {
  if (typeof value !== 'object' || value === null
    || Reflect.ownKeys(value).length !== 2
    || Reflect.get(value, 'outcome') !== 'allowed-once'
    || Reflect.get(value, 'remember') !== 'tool') return value
  return auth.rememberToolApproval(principal, sessionId, toolName)
    ? 'allowed-once'
    : 'unavailable'
}

/** Reject an allowlisted event whose runtime arguments are not lossless JSON data. */
function assertJsonArgs(event: string, args: readonly unknown[]): JsonValue[] {
  for (const [index, arg] of args.entries()) {
    if (!isJsonValue(arg)) {
      throw new Error(`forwarded host event "${event}" argument ${String(index)} is not lossless JSON data`)
    }
  }
  return args as JsonValue[]
}

function scopedSessionId(event: string, args: readonly JsonValue[]): string | undefined {
  if (event === 'agent-preset/selected'
    || event === 'api-session/activity'
    || event === 'api-session/removed'
    || event === 'api-session/status'
    || event === 'api-session/error') {
    return typeof args[0] === 'string' && args[0].length > 0 ? args[0] : undefined
  }
  if (event === 'api-session/added') {
    const summary = args[0]
    return typeof summary === 'object' && summary !== null && !Array.isArray(summary)
      && typeof summary.id === 'string' && summary.id.length > 0
      ? summary.id
      : undefined
  }
  if (event === 'goal/activation-changed') {
    const payload = args[0]
    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      && typeof payload.sessionId === 'string' && payload.sessionId.length > 0
      ? payload.sessionId
      : undefined
  }
  return undefined
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && typeof Reflect.get(value, 'then') === 'function'
}
