/** Host Workspace Remote owner: explicit commands and reconnect-safe state. */

import { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { WorkspaceCommands } from './commands.ts'
import { DirectoryPickerController } from './directory-picker.ts'
import { WorkspaceFeed } from './feed.ts'
import type {
  WorkspaceArchiveSessionRequest,
  WorkspaceArchiveValue,
  WorkspaceCreateRequest,
  WorkspaceCreateValue,
  WorkspaceDeleteRequest,
  WorkspaceDeleteValue,
  WorkspaceFollowFrame,
  WorkspaceInsertBeforeRequest,
  WorkspaceInsertSessionBeforeRequest,
  WorkspaceOrderValue,
  WorkspaceRenameRequest,
  WorkspaceValue,
} from './types.ts'
import type { SocWorkspaceAuth } from './soc-auth.ts'

export type * from './types.ts'
export { DirectoryPickerController } from './directory-picker.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Workspace business API and Remote namespace owner. */
    workspaceController: WorkspaceController
  }
}

/** Host service backing the generated `ctx.remote.workspace` namespace. */
export class WorkspaceController extends TypertRemoteService {
  static inject = ['typert', 'workspaceRegistry', 'socAuth']

  private readonly commands: WorkspaceCommands
  private readonly feed: WorkspaceFeed

  private get auth(): SocWorkspaceAuth | undefined {
    return this.ctx.get('socAuth')
  }

  private async requireWorkspace(workspaceId: string): Promise<void> {
    const auth = this.auth
    if (auth === undefined) return
    auth.requireUser()
    if (!await auth.ownsWorkspace(workspaceId)) throw workspaceNotFound(workspaceId)
  }

  private async requireSession(sessionId: string): Promise<void> {
    const auth = this.auth
    if (auth === undefined) return
    auth.requireUser()
    if (!await auth.ownsSession(sessionId)) throw sessionNotFound(sessionId)
  }

  /** @param ctx - Host context containing the Workspace registry. */
  constructor(ctx: Context) {
    super(ctx, 'workspaceController', { namespace: 'workspace' })
    this.commands = new WorkspaceCommands(ctx)
    this.feed = new WorkspaceFeed(ctx)
    // This package is the Loader entry for both Remote owners it hosts: the
    // directory-picking seam is abstract and never an entry itself. The child
    // stays pending until a picking backend is composed, so a host without one
    // registers no picking namespace instead of answering an unservable verb.
    ctx.plugin(DirectoryPickerController)
  }

  /**
   * Create or idempotently resolve one Workspace over an existing directory.
   * @param request - directory path to register.
   * @returns the Workspace and whether this call created it.
   */
  @Remote('create')
  async create(request: WorkspaceCreateRequest): Promise<WorkspaceCreateValue> {
    const auth = this.auth
    if (auth === undefined) return this.commands.create(request)
    auth.requireUser()
    let path: string
    try {
      path = await auth.privateWorkspacePath(request.path)
    } catch {
      throw new RemoteError('workspace/invalid-path', 'workspace name is invalid', { path: '' })
    }
    const value = await this.commands.create({ path })
    if (!await auth.claimWorkspace(value.workspace.workspaceId, path)) {
      throw workspaceNotFound(String(value.workspace.workspaceId))
    }
    return value
  }

  /**
   * Rename one Workspace to a unique non-blank title.
   * @param request - Workspace identity and proposed title.
   * @returns the updated Workspace projection.
   */
  @Remote('rename')
  async rename(request: WorkspaceRenameRequest): Promise<WorkspaceValue> {
    await this.requireWorkspace(request.workspaceId)
    if (await this.auth?.isGeneralWorkspace(request.workspaceId)) {
      throw new RemoteError('workspace/name-conflict', 'General is protected', { name: 'General' })
    }
    return this.commands.rename(request)
  }

  /**
   * Remove one Workspace registration while retaining files and Sessions.
   * @param request - Workspace identity to remove.
   * @returns deletion confirmation.
   */
  @Remote('delete')
  async delete(request: WorkspaceDeleteRequest): Promise<WorkspaceDeleteValue> {
    await this.requireWorkspace(request.workspaceId)
    if (await this.auth?.isGeneralWorkspace(request.workspaceId)) {
      throw new RemoteError('workspace/name-conflict', 'General is protected', { name: 'General' })
    }
    const value = await this.commands.delete(request)
    await this.auth?.releaseWorkspace(request.workspaceId)
    return value
  }

  /**
   * Move one Workspace within the registry display order.
   * @param request - moved Workspace and optional anchor.
   * @returns the complete resulting Workspace order.
   */
  @Remote('insertBefore')
  async insertBefore(request: WorkspaceInsertBeforeRequest): Promise<WorkspaceOrderValue> {
    await this.requireWorkspace(request.workspaceId)
    if (request.beforeWorkspaceId !== undefined) await this.requireWorkspace(request.beforeWorkspaceId)
    const value = await this.commands.insertBefore(request)
    const allowed = await this.auth?.ownedWorkspaceIds()
    return allowed === undefined
      ? value
      : { workspaceIds: value.workspaceIds.filter(id => allowed.has(String(id))) }
  }

  /**
   * Move one accounted Session within a Workspace.
   * @param request - Workspace, Session, and optional anchor identities.
   * @returns the updated Workspace projection.
   */
  @Remote('insertSessionBefore')
  async insertSessionBefore(request: WorkspaceInsertSessionBeforeRequest): Promise<WorkspaceValue> {
    await this.requireWorkspace(request.workspaceId)
    await this.requireSession(request.sessionId)
    if (request.beforeSessionId !== undefined) await this.requireSession(request.beforeSessionId)
    return this.commands.insertSessionBefore(request)
  }

  /**
   * Hide one known Session from Workspace grouping surfaces.
   * @param request - Session identity to archive.
   * @returns the complete resulting archive set.
   */
  @Remote('archiveSession')
  async archiveSession(request: WorkspaceArchiveSessionRequest): Promise<WorkspaceArchiveValue> {
    await this.requireSession(request.sessionId)
    const value = await this.commands.archiveSession(request)
    const allowed = await this.auth?.ownedSessionIds()
    return allowed === undefined
      ? value
      : { archivedSessionIds: value.archivedSessionIds.filter(id => allowed.has(String(id))) }
  }

  /**
   * Stream a complete Workspace baseline followed by ordered increments.
   * @param signal - generation cancellation.
   * @returns baseline followed by ordered Workspace increments.
   */
  @Remote({ mode: 'stream' })
  async *follow(signal: AbortSignal): AsyncIterable<WorkspaceFollowFrame> {
    const auth = this.auth
    if (auth === undefined) {
      yield* this.feed.follow(signal)
      return
    }
    auth.requireUser()
    const visible = new Set(await auth.ownedWorkspaceIds())
    for await (const frame of this.feed.follow(signal)) {
      const filtered = await filterWorkspaceFrame(frame, auth, visible)
      if (filtered !== undefined) yield filtered
    }
  }
}

function workspaceNotFound(workspaceId: string): RemoteError<'workspace/not-found'> {
  return new RemoteError('workspace/not-found', 'workspace not found', { workspaceId: workspaceId as never })
}

function sessionNotFound(sessionId: string): RemoteError<'session/not-found'> {
  return new RemoteError('session/not-found', 'session not found', { sessionId: sessionId as never })
}

async function filterWorkspaceFrame(
  frame: WorkspaceFollowFrame,
  auth: SocWorkspaceAuth,
  visible: Set<string>,
): Promise<WorkspaceFollowFrame | undefined> {
  const sessionIds = await auth.ownedSessionIds()
  if (frame.type === 'baseline') {
    const workspaceIds = await auth.ownedWorkspaceIds()
    visible.clear()
    for (const id of workspaceIds) visible.add(id)
    return {
      type: 'baseline',
      value: {
        items: frame.value.items
          .filter(item => visible.has(String(item.workspaceId)))
          .map(item => ({ ...item, sessionIds: item.sessionIds.filter(id => sessionIds.has(String(id))) })),
        archivedSessionIds: frame.value.archivedSessionIds.filter(id => sessionIds.has(String(id))),
      },
    }
  }
  if (frame.type === 'upsert') {
    if (!await auth.ownsWorkspace(frame.workspace.workspaceId)) return undefined
    visible.add(String(frame.workspace.workspaceId))
    return { ...frame, workspace: {
      ...frame.workspace,
      sessionIds: frame.workspace.sessionIds.filter(id => sessionIds.has(String(id))),
    } }
  }
  if (frame.type === 'remove') {
    if (!visible.delete(String(frame.workspaceId))) return undefined
    return frame
  }
  if (frame.type === 'order') {
    return { ...frame, workspaceIds: frame.workspaceIds.filter(id => visible.has(String(id))) }
  }
  return { ...frame, archivedSessionIds: frame.archivedSessionIds.filter(id => sessionIds.has(String(id))) }
}

export default WorkspaceController
