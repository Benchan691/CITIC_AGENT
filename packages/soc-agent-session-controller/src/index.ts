/** Session Remote owner: cold reads, explicit Agent commands, and live control state. */

import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import z from '@deepseek-ai/schemastery'
import { errorChain } from '@deepseek-ai/dsh-llm'
import type {} from 'dsh-soc-agent-file-upload'
import { canOpenNativePath, nativeFileManager, openNativePath, revealNativePath } from '@deepseek-ai/dsh-native-command'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { SessionInspection, SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionObservation } from '@deepseek-ai/dsh-session-query'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  ApiSessionAgentController,
  inspectApiSession,
  type ApiSessionAgentResult,
} from './agent.ts'
import { SessionCommandController } from './commands.ts'
import { SessionControlController } from './control.ts'
import { SessionHistoryController } from './history.ts'
import { SessionFileReferences } from './file-references.ts'
import { ApiSessionList } from './list.ts'
import { buildModelCatalog } from './catalog.ts'
import { installModelSelectionProjection } from './model-selection-projection.ts'
import { SessionSkillCatalog } from './skill-catalog.ts'
import { SessionMediaReferences } from './media-references.ts'
import type {
  ModelCatalog,
  SessionAttachmentRequest,
  SessionAttachmentValue,
  SessionCancelRequest,
  SessionCancelValue,
  SessionControlFrame,
  SessionCreateRequest,
  SessionCreateValue,
  SessionDeleteRequest,
  SessionDeleteValue,
  SessionFollowFrame,
  SessionFollowRequest,
  SessionForkRequest,
  SessionForkValue,
  SessionListRequest,
  SessionListValue,
  SessionOpenWorkspacePathRequest,
  SessionOpenWorkspacePathValue,
  SessionPage,
  SessionPageRequest,
  SessionPromptRequest,
  SessionPromptValue,
  SessionRenameRequest,
  SessionRenameValue,
  SessionSearchRequest,
  SessionSearchValue,
  SessionSelectModelRequest,
  SessionSelectModelValue,
  SessionUpdateQueueRequest,
  SessionUpdateQueueValue,
} from './types.ts'
import type { SocSessionAuth } from './soc-auth.ts'

export type * from './types.ts'
export { ApiSessionNotFound } from './agent.ts'
export { SessionFileReferences } from './file-references.ts'
export { SessionSkillCatalog } from './skill-catalog.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Session business API and Remote namespace owner. */
    sessionController: SessionController
  }
}

/** Session Controller deployment policy. */
export interface Config {
  /** Override platform desktop-opener detection. */
  readonly nativeOpen?: boolean
}

/** Host integrations replaceable by direct unit tests. */
export interface SessionControllerInternals {
  /** Native default-application handoff. */
  readonly openPath?: (path: string, signal: AbortSignal) => Promise<void>
  /** Native file-manager handoff. */
  readonly revealPath?: (path: string, signal: AbortSignal) => Promise<void>
  /** Native handoff availability probe. */
  readonly canOpenPath?: () => boolean
}

/** SOC persistence extension implemented by the isolated JSONL backend. */
interface DeletableSessionPersistence extends SessionPersistence {
  deleteSession(sessionId: SessionId): Promise<boolean>
}

/** Host service backing the generated `ctx.remote.session` namespace. */
export class SessionController extends TypertRemoteService {
  static inject = [
    'agentDefaultModel',
    'agents',
    'attachments',
    'fileUploads',
    'llm',
    'sessions',
    'sessionProjections',
    'sessionPersistence',
    'sessionQuery',
    'socAuth',
    'typert',
    'workspaceRegistry',
  ]

  static Config: z<Config> = z.object({
    nativeOpen: z.boolean(),
  })

  private readonly agents: ApiSessionAgentController
  private readonly commands: SessionCommandController
  private readonly controlState: SessionControlController
  private readonly history: SessionHistoryController
  private readonly listState: ApiSessionList
  private readonly openPath: (path: string, signal: AbortSignal) => Promise<void>
  private readonly revealPath: (path: string, signal: AbortSignal) => Promise<void>
  private readonly canOpenPath: () => boolean
  private readonly promotions = new Set<Promise<void>>()

  private get auth(): SocSessionAuth | undefined {
    return this.ctx.get('socAuth')
  }

  private async requireOwnedSession(sessionId: SessionId): Promise<void> {
    const auth = this.auth
    if (auth === undefined) return
    auth.requireUser()
    if (!await auth.ownsSession(sessionId)) throw sessionNotFound(sessionId)
  }

  private async requireOwnedAddress(address: SessionPageRequest['address']): Promise<void> {
    if (address.kind === 'session') {
      await this.requireOwnedSession(address.sessionId)
      return
    }
    await this.requireOwnedSession(address.parentSessionId)
    await this.requireOwnedSession(address.childSessionId)
  }

  /**
   * @param ctx - Host context containing the Session capability assembly.
   * @param config - native-opener deployment policy.
   * @param internals - host integrations replaceable by direct unit tests.
   */
  constructor(ctx: Context, config: Config, internals: SessionControllerInternals = {}) {
    super(ctx, 'sessionController', { namespace: 'session' })
    installModelSelectionProjection(ctx)
    this.agents = new ApiSessionAgentController(ctx)
    this.commands = new SessionCommandController(ctx, this.agents, process.cwd())
    ctx.effect(() => ctx.fileUploads.registerAgentResolver(async (sessionId) => {
      const result = await this.agents.resolveAgent(sessionId)
      if ('error' in result) throw result.error
      return result.agent
    }), 'session-controller: file-upload Agent resolver')
    this.controlState = new SessionControlController(ctx)
    // Registered before history so reverse-order teardown closes every
    // follower before waiting for already-admitted promotions.
    ctx.effect(() => async () => {
      await Promise.allSettled([...this.promotions])
    }, 'session-controller.promotions')
    this.history = new SessionHistoryController(ctx, (observation) => { this.promote(observation) })
    this.listState = new ApiSessionList(ctx)
    this.openPath = internals.openPath ?? openNativePath
    this.revealPath = internals.revealPath ?? revealNativePath
    this.canOpenPath = internals.canOpenPath
      ?? (() => config.nativeOpen ?? (internals.openPath !== undefined || canOpenNativePath()))
    ctx.plugin(SessionFileReferences)
    ctx.plugin(SessionMediaReferences)
    ctx.plugin(SessionSkillCatalog)

    ctx.on('session/created', (session) => {
      ctx.emit('api-session/added', this.listState.summaryFor(session))
    })
    ctx.on('session/disposed', (session) => {
      ctx.emit('api-session/removed', session.id)
    })
    ctx.on('agent/status', ({ agent, status }) => {
      ctx.emit('api-session/status', agent.id, status === 'running')
    })
    ctx.on('agent/error', ({ agent, error }) => {
      ctx.emit('api-session/error', agent.id, errorChain(error))
    })
    ctx.on('session/event', (session, event) => {
      if (event.type === 'request/header') {
        const agent = ctx.agents.get(session.id)
        if (agent?.session === session) this.agents.consumeSelection(
          agent,
          event.data.header.config.provider,
          event.data.header.config.model,
          event.data.header.config.reasoningEffort,
        )
      }
      if (event.type !== 'user/message' || event.data.source.kind !== 'user') return
      ctx.emit('api-session/activity', session.id, event.time)
    })
  }

  private promote(observation: SessionObservation): void {
    const sessionId = observation.header.id
    const task = (async () => {
      using ownedObservation = observation
      const result = await this.agents.resolveObservedAgent(ownedObservation)
      if ('error' in result) this.ctx.emit('api-session/error', sessionId, result.error.message)
    })().catch((error: unknown) => {
      this.ctx.logger.error(`session-controller: background activation for "${sessionId}" failed: ${errorChain(error)}`)
    })
    this.promotions.add(task)
    void task.finally(() => { this.promotions.delete(task) })
  }

  /**
   * Resolve or resume one ordinary Session for another Host API domain.
   * @param sessionId - Session identity whose Agent owns the operation.
   * @returns the live Agent or the stable Session-domain failure.
   */
  resolveAgent(sessionId: SessionId): Promise<ApiSessionAgentResult> {
    return this.agents.resolveAgent(sessionId)
  }

  /**
   * Inspect one attached or persisted Session without activating its Agent.
   * @param sessionId - durable Session identity.
   * @param signal - optional caller cancellation for persistence reads.
   * @returns the current attached state or persisted header and event prefix.
   */
  inspect(
    sessionId: SessionId,
    signal?: AbortSignal,
  ): Promise<SessionInspection> {
    const attached = this.ctx.sessions.get(sessionId)
    if (attached !== undefined) {
      return Promise.resolve({
        meta: attached.header,
        inheritedEventCount: attached.inheritedEventCount,
        events: attached.snapshotEvents(),
      })
    }
    return inspectApiSession(this.ctx, sessionId, signal)
  }

  /**
   * Read all visible Session rows without resuming an Agent.
   * @param _request - reserved empty list request.
   * @param signal - cancellation for persistence reads.
   * @returns visible Session summaries ordered by activity.
   */
  @Remote('list')
  async list(_request: SessionListRequest, signal: AbortSignal): Promise<SessionListValue> {
    const allowed = await this.auth?.ownedSessionIds()
    return { items: await this.listState.list(allowed, signal) }
  }

  /**
   * Search visible Session content without resuming an Agent.
   * @param request - literal message-content query.
   * @param signal - cancellation for list and search reads.
   * @returns authorized bounded Session search results.
   */
  @Remote('search')
  async search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue> {
    const allowed = await this.auth?.ownedSessionIds()
    return this.listState.search(request.query, signal, allowed)
  }

  /**
   * Create or idempotently adopt one ordinary Session.
   * @param request - requested identity, location, and Agent preset.
   * @returns the Session identity and resolved preset when configured.
   */
  @Remote('create')
  async create(request: SessionCreateRequest): Promise<SessionCreateValue> {
    const auth = this.auth
    if (auth === undefined) return this.commands.create(request)
    const principal = auth.requireUser()
    if (request.cwd !== undefined) {
      throw new RemoteError('gateway/bad-request', 'SOC sessions must belong to an owned workspace', {})
    }
    const workspaceId = request.workspaceId
      ?? brandString<WorkspaceId>((await auth.ensureGeneral(principal.userId)).workspaceId)
    if (!await auth.ownsWorkspace(workspaceId)) throw workspaceNotFound(workspaceId)
    const sessionId = request.sessionId ?? brandString<SessionId>(`session-${randomUUID()}`)
    if (!await auth.claimSession(sessionId, workspaceId)) throw sessionNotFound(sessionId)
    try {
      const { cwd: _ignoredCwd, ...safeRequest } = request
      const value = await this.commands.create({ ...safeRequest, workspaceId, sessionId })
      auth.bindAgentSession(value.sessionId, principal.applicationSessionId)
      return value
    } catch (error) {
      if (!(error instanceof RemoteError) || error.code !== 'session/workspace-attach-failed') {
        await auth.releaseSession(sessionId)
      }
      throw error
    }
  }

  /**
   * Permanently delete one Session after closing its live Agent owner.
   * Unknown identities and already-removed identities remain indistinguishable.
   */
  @Remote('delete')
  async delete(request: SessionDeleteRequest): Promise<SessionDeleteValue> {
    const sessionId = request.sessionId
    await this.requireOwnedSession(sessionId)
    const closedLiveOwner = await this.agents.disposeSession(sessionId)
    if (!closedLiveOwner && this.ctx.agents.get(sessionId) !== undefined) {
      throw new RemoteError(
        'session/agent-busy',
        `session "${sessionId}" is owned by another live Agent controller`,
        { reason: 'live-owner-not-held-by-session-controller' },
      )
    }

    const persistence = this.ctx.sessionPersistence as DeletableSessionPersistence
    if (typeof persistence.deleteSession !== 'function') {
      throw new RemoteError(
        'gateway/internal',
        'configured Session persistence does not support permanent deletion',
        {},
      )
    }
    const deleted = await persistence.deleteSession(sessionId)
    if (!deleted) {
      throw new RemoteError(
        'session/not-found',
        `session "${sessionId}" not found`,
        { sessionId },
      )
    }

    await Promise.all(this.ctx.workspaceRegistry.list()
      .filter(workspace => workspace.sessionIds.includes(sessionId))
      .map(workspace => workspace.detachSession(sessionId)))
    // Disposing a live owner already publishes this once through
    // session/disposed. Cold deletion has no Session lifecycle event.
    if (!closedLiveOwner) this.ctx.emit('api-session/removed', sessionId)
    await this.auth?.releaseSession(sessionId)
    return { deleted: true }
  }

  /**
   * Select one Session-local model after explicitly resuming the Session.
   * @param request - Session identity and requested model selection.
   * @returns the normalized selection installed for the Session.
   */
  @Remote('selectModel')
  async selectModel(request: SessionSelectModelRequest): Promise<SessionSelectModelValue> {
    await this.requireOwnedSession(request.sessionId)
    return this.commands.selectModel(request)
  }

  /**
   * Describe every currently routable model for Host-generation selectors.
   * @returns provider-grouped models, the deployment default, and isolated provider failures.
   */
  @Remote('modelCatalog')
  modelCatalog(): Promise<ModelCatalog> {
    this.auth?.requireUser()
    return buildModelCatalog(this.ctx)
  }

  /**
   * Report whether this deployment can hand a Session workspace path to a native desktop.
   * @returns true when the matching open operation is available.
   */
  @Remote
  canOpenWorkspacePath(): boolean {
    this.auth?.requireUser()
    return false
  }

  /**
   * Describe the serving desktop for authenticated file-action routes.
   * @returns Host name, configured availability, and platform-specific file-manager behavior.
   */
  workspaceDesktop(): { name: string; available: boolean; fileManager: 'finder' | 'explorer' | 'directory' | null } {
    const fileManager = nativeFileManager()
    return { name: hostname(), available: fileManager !== null && this.canOpenPath(), fileManager }
  }

  /**
   * Open one path prepared by a Session-aware caller on the Host desktop.
   * @param request - path after best-effort Session workspace resolution.
   * @param signal - caller lifetime; abort terminates the native command.
   * @returns confirmation after the native opener accepts the path.
   * @throws RemoteError when the request is invalid, cancelled, or the opener fails.
   */
  @Remote('openWorkspacePath')
  async openWorkspacePath(
    request: SessionOpenWorkspacePathRequest,
    signal: AbortSignal,
  ): Promise<SessionOpenWorkspacePathValue> {
    this.auth?.requireUser()
    signal.throwIfAborted()
    throw new RemoteError('gateway/bad-request', 'Open In is disabled for the SOC workspace model', {})
  }

  /**
   * Rename one Session after explicitly resuming it.
   * @param request - Session identity and proposed title.
   * @returns the accepted title and durable event sequence.
   */
  @Remote('rename')
  async rename(request: SessionRenameRequest): Promise<SessionRenameValue> {
    await this.requireOwnedSession(request.sessionId)
    return this.commands.rename(request)
  }

  /**
   * Fork one cold-readable completed-turn prefix into a new Session.
   * @param request - source Session and optional event anchor.
   * @returns the new Session identity.
   */
  @Remote('fork')
  async fork(request: SessionForkRequest): Promise<SessionForkValue> {
    await this.requireOwnedSession(request.sessionId)
    const value = await this.commands.fork(request)
    const auth = this.auth
    if (auth !== undefined) {
      const workspaceId = await auth.workspaceForSession(request.sessionId)
      if (!workspaceId || !await auth.claimSession(value.sessionId, workspaceId)) {
        throw sessionNotFound(request.sessionId)
      }
      auth.bindAgentSession(value.sessionId)
    }
    return value
  }

  /**
   * Admit one prompt after explicitly resuming its Session.
   * @param request - Session identity, prompt content, source metadata, and delivery mode.
   * @param signal - caller cancellation before prompt admission begins.
   * @returns acknowledgement that the Agent accepted the prompt.
   */
  @Remote('prompt')
  async prompt(request: SessionPromptRequest, signal: AbortSignal): Promise<SessionPromptValue> {
    await this.requireOwnedSession(request.sessionId)
    signal.throwIfAborted()
    return this.commands.prompt(request)
  }

  /**
   * Read one image proven reachable from the addressed Session log.
   * @param request - Session and attachment identities used for authorization.
   * @returns the durable attachment reference and base64-encoded bytes.
   */
  @Remote('attachment')
  async attachment(request: SessionAttachmentRequest): Promise<SessionAttachmentValue> {
    await this.requireOwnedSession(request.sessionId)
    return this.commands.attachment(request)
  }

  /**
   * Mutate one still-pending queue occurrence on a live Agent.
   * @param request - Session, queue item, and requested mutation.
   * @returns acknowledgement that the queue mutation was applied.
   */
  @Remote('updateQueue')
  async updateQueue(request: SessionUpdateQueueRequest): Promise<SessionUpdateQueueValue> {
    await this.requireOwnedSession(request.sessionId)
    return this.commands.updateQueue(request)
  }

  /**
   * Cancel one active Agent turn without dropping its pending inbox.
   * @param request - Session whose active Agent turn is cancelled.
   * @returns acknowledgement that cancellation was requested.
   */
  @Remote('cancel')
  async cancel(request: SessionCancelRequest): Promise<SessionCancelValue> {
    await this.requireOwnedSession(request.sessionId)
    return this.commands.cancel(request)
  }

  /**
   * Read one cold-safe, message-aligned Session history page.
   * @param request - durable address, backward cursor, and page budget.
   * @param signal - cancellation for persistence reads.
   * @returns one chronological page.
   */
  @Remote('page')
  async page(request: SessionPageRequest, signal: AbortSignal): Promise<SessionPage> {
    await this.requireOwnedAddress(request.address)
    return this.history.page(request, signal)
  }

  /**
   * Follow one Session log from its opening or resume cursor.
   * @param request - durable address and last committed sequence already held by the caller.
   * @param signal - cancellation owned by the Remote stream carrier.
   * @returns a complete opening snapshot followed by gap-free durable event
   *   frames and optional cursorless assistant-stream frames.
   */
  @Remote({ mode: 'stream' })
  async *follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame> {
    await this.requireOwnedAddress(request.address)
    yield* this.history.follow(request, signal)
  }

  /**
   * Stream a complete live-control baseline followed by replacement frames.
   * @param signal - cancellation owned by the Remote stream carrier.
   * @returns one complete baseline followed by live replacement frames.
   */
  @Remote({ mode: 'stream' })
  async *control(signal: AbortSignal): AsyncIterable<SessionControlFrame> {
    const auth = this.auth
    if (auth === undefined) {
      yield* this.controlState.control(signal)
      return
    }
    auth.requireUser()
    for await (const frame of this.controlState.control(signal)) {
      const allowed = await auth.ownedSessionIds()
      const filtered = filterControlFrame(frame, allowed)
      if (filtered !== undefined) yield filtered
    }
  }

}

export { buildModelCatalog }
export default SessionController

function sessionNotFound(sessionId: SessionId): RemoteError<'session/not-found'> {
  return new RemoteError('session/not-found', `session "${sessionId}" not found`, { sessionId })
}

function workspaceNotFound(workspaceId: WorkspaceId): RemoteError<'workspace/not-found'> {
  return new RemoteError('workspace/not-found', 'workspace not found', { workspaceId })
}

function filterControlFrame(
  frame: SessionControlFrame,
  allowed: ReadonlySet<string>,
): SessionControlFrame | undefined {
  if (frame.type !== 'baseline') {
    return 'sessionId' in frame && allowed.has(String(frame.sessionId)) ? frame : undefined
  }
  const filterRecord = <T>(record: Readonly<Record<string, T>>): Readonly<Record<string, T>> =>
    Object.fromEntries(Object.entries(record).filter(([sessionId]) => allowed.has(sessionId)))
  return {
    ...frame,
    value: {
      ...frame.value,
      queues: filterRecord(frame.value.queues),
      jobs: filterRecord(frame.value.jobs),
      projections: filterRecord(frame.value.projections),
    },
  }
}
