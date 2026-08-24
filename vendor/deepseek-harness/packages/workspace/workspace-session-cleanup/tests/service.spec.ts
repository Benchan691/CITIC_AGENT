import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { chdir, cwd } from 'node:process'
import { join, relative } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  WorkspaceSessionCleanupError,
  WorkspaceSessionCleanupService,
} from '../src/service.ts'

const roots: string[] = []
const originalCwd = cwd()

afterEach(async () => {
  chdir(originalCwd)
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

interface Fixture {
  root: string
  workspace: string
  otherWorkspace: string
  service: WorkspaceSessionCleanupService
  persisted: Array<{ version: 0; id: ReturnType<typeof SessionId>; createdAt: number; cwd: string }>
  deleted: Set<string>
  deleteSession: ReturnType<typeof vi.fn>
}

async function fixture(): Promise<Fixture> {
  const root = await mkdtemp(join('/tmp', 'dsh-workspace-session-cleanup-'))
  roots.push(root)
  const workspace = join(root, 'workspace')
  const otherWorkspace = join(root, 'other')
  await mkdir(workspace)
  await mkdir(otherWorkspace)
  const persisted: Fixture['persisted'] = []
  const deleted = new Set<string>()
  const deleteSession = vi.fn(async (id: string) => {
    if (!persisted.some(header => header.id === id)) return false
    deleted.add(id)
    return true
  })
  const ctx = new Context()
  ctx.provide('sessionPersistence', {
    list: async () => persisted.filter(header => !deleted.has(header.id)),
    deleteSession,
  } as never)
  ctx.provide('sessions', {
    list: () => [],
    get: () => undefined,
  } as never)
  return { root, workspace, otherWorkspace, service: new WorkspaceSessionCleanupService(ctx), persisted, deleted, deleteSession }
}

function addSession(fixture: Fixture, id: string, cwd: string, createdAt = 0): void {
  fixture.persisted.push({ version: 0, id: SessionId(id), createdAt, cwd })
}

describe('WorkspaceSessionCleanupService', () => {
  it('previews one matching workspace session', async () => {
    const test = await fixture()
    addSession(test, 'one', `${test.workspace}/`, 10)
    addSession(test, 'other', test.otherWorkspace, 20)

    await expect(test.service.previewWorkspaceSessionCleanup(test.workspace)).resolves.toMatchObject({
      normalizedWorkspacePath: await realpath(test.workspace),
      matchingSessionCount: 1,
      matchingSessionIds: [SessionId('one')],
      matchingSessions: [{ sessionId: SessionId('one'), createdAt: 10, cwd: `${test.workspace}/` }],
    })
  })

  it('deletes multiple matching sessions and leaves another workspace alone', async () => {
    const test = await fixture()
    addSession(test, 'one', test.workspace)
    addSession(test, 'two', `${test.workspace}/../${relative(test.root, test.workspace)}`)
    addSession(test, 'other', test.otherWorkspace)

    await expect(test.service.deleteWorkspaceSessions(test.workspace)).resolves.toBe(2)
    expect(test.deleteSession.mock.calls.map(([id]) => id)).toEqual(['one', 'two'])
    expect(test.deleted).toEqual(new Set(['one', 'two']))
  })

  it('returns zero for a workspace with no sessions and is idempotent', async () => {
    const test = await fixture()
    await expect(test.service.deleteWorkspaceSessions(test.workspace)).resolves.toBe(0)
    addSession(test, 'one', test.workspace)
    await expect(test.service.deleteWorkspaceSessions(test.workspace)).resolves.toBe(1)
    await expect(test.service.deleteWorkspaceSessions(test.workspace)).resolves.toBe(0)
  })

  it('matches relative, parent-segment, trailing-slash, and symlink spellings', async () => {
    const test = await fixture()
    const link = join(test.root, 'workspace-link')
    await symlink(test.workspace, link, 'dir')
    addSession(test, 'one', test.workspace)
    addSession(test, 'two', `${test.workspace}/child/..`)

    chdir(test.root)
    const preview = await test.service.previewWorkspaceSessionCleanup('./workspace-link/../workspace/')
    expect(preview.matchingSessionIds).toEqual([SessionId('one'), SessionId('two')])
  })

  it('does not clean up when the workspace deletion itself fails', async () => {
    const test = await fixture()
    addSession(test, 'one', test.workspace)
    const deleteWorkspace = vi.fn(async () => false)
    if (await deleteWorkspace()) await test.service.deleteWorkspaceSessions(test.workspace)
    expect(test.deleteSession).not.toHaveBeenCalled()
    expect(test.persisted).toHaveLength(1)
  })

  it('cleans messages through the store deletion API rather than database access', async () => {
    const test = await fixture()
    const id = SessionId('live')
    const messages = new Map([[id, ['user message', 'assistant message']]])
    const live = { id, header: { version: 0, id, createdAt: 0, cwd: test.workspace } }
    const sessions = {
      list: () => [live],
      get: (candidate: ReturnType<typeof SessionId>) => messages.has(candidate) ? live : undefined,
      flush: vi.fn(async () => {}),
      deleteSession: vi.fn((candidate: ReturnType<typeof SessionId>) => messages.delete(candidate)),
    }
    const ctx = new Context()
    ctx.provide('sessionPersistence', { list: async () => [], deleteSession: vi.fn(async () => false) } as never)
    ctx.provide('sessions', sessions as never)
    const service = new WorkspaceSessionCleanupService(ctx)

    await expect(service.deleteWorkspaceSessions(test.workspace)).resolves.toBe(1)
    expect(sessions.deleteSession).toHaveBeenCalledWith(id)
    expect(messages.has(id)).toBe(false)
  })

  it('reports partial failures with deleted and failed ids', async () => {
    const test = await fixture()
    addSession(test, 'one', test.workspace)
    addSession(test, 'two', test.workspace)
    test.deleteSession.mockImplementation(async (id: string) => {
      if (id === 'two') throw new Error('store unavailable')
      test.deleted.add(id)
      return true
    })

    await expect(test.service.deleteWorkspaceSessions(test.workspace)).rejects.toMatchObject({
      details: {
        normalizedWorkspacePath: await realpath(test.workspace),
        deletedSessionCount: 1,
        failedSessionIds: [SessionId('two')],
      },
    } satisfies Partial<WorkspaceSessionCleanupError>)
  })

  it('rejects malformed and missing workspace paths', async () => {
    const test = await fixture()
    await expect(test.service.previewWorkspaceSessionCleanup('')).rejects.toBeInstanceOf(WorkspaceSessionCleanupError)
    await expect(test.service.previewWorkspaceSessionCleanup(join(test.root, 'missing'))).rejects.toThrow(/cannot canonicalize/)
  })

  it('reports session-store failures instead of treating them as an empty workspace', async () => {
    const test = await fixture()
    const ctx = new Context()
    ctx.provide('sessionPersistence', { list: async () => { throw new Error('database unavailable') } } as never)
    ctx.provide('sessions', { list: () => [] } as never)
    const service = new WorkspaceSessionCleanupService(ctx)

    await expect(service.previewWorkspaceSessionCleanup(test.workspace)).rejects.toMatchObject({
      message: expect.stringContaining('cannot list Harness sessions'),
    })
  })
})
