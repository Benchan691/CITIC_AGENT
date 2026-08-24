import { Context } from '@deepseek-ai/cordis'
import SessionStore, { FolderId, SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { oneTurnLog, meta } from '../../session-persistence/tests/contract.ts'
import SessionFolderStore from '../src/index.ts'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function setup(existing = 0): Promise<{ ctx: Context; dispose: () => Promise<void> }> {
  const root = await mkdtemp(join('/tmp', 'dsh-session-folders-'))
  roots.push(root)
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  const persistence = await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  for (let i = 0; i < existing; i++) {
    const id = SessionId(`existing-${i}`)
    await ctx.sessionPersistence.create(meta(String(id), '/runtime'))
    await ctx.sessionPersistence.append(id, oneTurnLog())
  }
  const folders = await ctx.plugin(SessionFolderStore)
  return { ctx, dispose: async () => { await folders.dispose(); await persistence.dispose() } }
}

describe('native logical session folders', () => {
  it('creates, renames, lists, and migrates existing sessions to General', async () => {
    const { ctx, dispose } = await setup(1)
    try {
      const general = (await ctx.sessionFolders.listFolders()).find(folder => folder.name === 'General')
      expect(general?.sessionIds).toEqual([SessionId('existing-0')])
      const created = await ctx.sessionFolders.createFolder('Customer A - WAF Investigation')
      expect(created.name).toBe('Customer A - WAF Investigation')
      const renamed = await ctx.sessionFolders.renameFolder(created.id, 'Customer A')
      expect(renamed.name).toBe('Customer A')
      expect((await ctx.sessionFolders.listFolders()).map(folder => folder.name)).toContain('Customer A')
    } finally {
      await dispose()
    }
  })

  it('supports multiple sessions, moves, and deletes sessions without deleting folders or messages', async () => {
    const { ctx, dispose } = await setup()
    try {
      const folder = await ctx.sessionFolders.createFolder('Customer B')
      const ids = [SessionId('b-1'), SessionId('b-2')]
      for (const id of ids) {
        await ctx.sessionPersistence.create({ ...meta(String(id), '/runtime'), folderId: folder.id })
        await ctx.sessionPersistence.append(id, oneTurnLog())
      }
      expect(await ctx.sessionFolders.listSessionsByFolder(folder.id)).toEqual(ids)
      const general = (await ctx.sessionFolders.listFolders()).find(candidate => candidate.name === 'General')!
      await ctx.sessionFolders.moveSessionToFolder(ids[0]!, general.id)
      expect(await ctx.sessionFolders.listSessionsByFolder(folder.id)).toEqual([ids[1]])
      expect(await ctx.sessionFolders.deleteSession(ids[1]!)).toBe(true)
      expect(await ctx.sessionFolders.getFolder(folder.id)).toBeDefined()
      await expect(ctx.sessionPersistence.load(ids[1]!)).rejects.toThrow()
      expect(await ctx.sessionFolders.deleteSession(ids[1]!)).toBe(false)
    } finally {
      await dispose()
    }
  })

  it('prefers a live session move over its creation-time folder header', async () => {
    const { ctx, dispose } = await setup()
    try {
      const first = await ctx.sessionFolders.createFolder('First live owner')
      const second = await ctx.sessionFolders.createFolder('Second live owner')
      const id = SessionId('live-move')
      ctx.sessions.create(id, { meta: { cwd: '/runtime', folderId: first.id } })

      await ctx.sessionFolders.moveSessionToFolder(id, second.id)

      expect(ctx.sessionFolders.folderIdForSession(id)).toBe(second.id)
      expect(await ctx.sessionFolders.listSessionsByFolder(first.id)).toEqual([])
      expect(await ctx.sessionFolders.listSessionsByFolder(second.id)).toEqual([id])
    } finally {
      await dispose()
    }
  })

  it('deletes an empty or populated folder safely and leaves unrelated folders intact', async () => {
    const { ctx, dispose } = await setup()
    try {
      const empty = await ctx.sessionFolders.createFolder('Empty')
      expect(await ctx.sessionFolders.deleteFolder(empty.id)).toBe(0)
      const first = await ctx.sessionFolders.createFolder('First')
      const second = await ctx.sessionFolders.createFolder('Second')
      const id = SessionId('first-session')
      await ctx.sessionPersistence.create({ ...meta(String(id), '/runtime'), folderId: first.id })
      await ctx.sessionPersistence.append(id, oneTurnLog())
      expect(await ctx.sessionFolders.deleteFolder(first.id)).toBe(1)
      expect(await ctx.sessionFolders.getFolder(second.id)).toBeDefined()
      await expect(ctx.sessionPersistence.load(id)).rejects.toThrow()
      await expect(ctx.sessionFolders.deleteFolder(first.id)).rejects.toThrow(/not found/)
    } finally {
      await dispose()
    }
  })

  it('rejects nonexistent folder references and malformed names', async () => {
    const { ctx, dispose } = await setup()
    try {
      await expect(ctx.sessionFolders.createFolder('  ')).rejects.toThrow(/must not be empty/)
      await expect(ctx.sessionFolders.moveSessionToFolder(SessionId('missing'), FolderId('missing-folder'))).rejects.toThrow(/not found/)
    } finally {
      await dispose()
    }
  })

  it('keeps the folder and failed session data when a session deletion fails', async () => {
    const { ctx, dispose } = await setup()
    try {
      const folder = await ctx.sessionFolders.createFolder('Failure-safe')
      const id = SessionId('failure-session')
      await ctx.sessionPersistence.create({ ...meta(String(id), '/runtime'), folderId: folder.id })
      await ctx.sessionPersistence.append(id, oneTurnLog())
      vi.spyOn(ctx.sessionPersistence, 'deleteSession').mockRejectedValueOnce(new Error('store unavailable'))

      await expect(ctx.sessionFolders.deleteFolder(folder.id)).rejects.toThrow(/cleanup failed/)
      expect(await ctx.sessionFolders.getFolder(folder.id)).toBeDefined()
      expect((await ctx.sessionPersistence.list()).some(header => header.id === id)).toBe(true)
    } finally {
      await dispose()
    }
  })
})
