import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from 'dsh-soc-agent-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import { describe, expect, it, vi } from 'vitest'
import {
  createSessionTestController,
  createSessionTestRemote,
} from './test-remote.ts'

async function context(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  return ctx
}

describe('session/openWorkspacePath SOC policy', () => {
  it('reports Open In unavailable regardless of native or injected desktop support', async () => {
    for (const defaults of [
      { nativeOpen: true },
      { openPath: async () => {} },
      { canOpenPath: () => true },
    ]) {
      const ctx = await context()
      try {
        const remote = createSessionTestRemote(ctx, {
          defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
          cwd: '/default',
          ...defaults,
        })
        await expect(remote.canOpenWorkspacePath()).resolves.toEqual({ ok: true, value: false })
      } finally {
        await ctx.fiber.dispose()
      }
    }
  })

  it('rejects open and reveal requests without invoking a native adapter', async () => {
    const ctx = await context()
    const openPath = vi.fn(async () => {})
    const revealPath = vi.fn(async () => {})
    try {
      const controller = createSessionTestController(ctx, {
        defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
        cwd: '/default',
        openPath,
        revealPath,
      })
      expect(controller.workspaceDesktop()).toMatchObject({
        available: false,
        name: expect.any(String) as string,
      })
      for (const action of ['open', 'reveal'] as const) {
        await expect(controller.openWorkspacePath(
          { path: '/workspace/report.txt', action },
          new AbortController().signal,
        )).rejects.toMatchObject({
          code: 'gateway/bad-request',
          message: 'Open In is disabled for the SOC workspace model',
        })
      }
      expect(openPath).not.toHaveBeenCalled()
      expect(revealPath).not.toHaveBeenCalled()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('preserves caller cancellation ahead of the disabled-feature response', async () => {
    const ctx = await context()
    try {
      const controller = createSessionTestController(ctx, {
        defaultModelSelection: () => ({ provider: 'p', model: 'm' }),
        cwd: '/default',
      })
      const abort = new AbortController()
      const reason = new Error('cancelled')
      abort.abort(reason)
      await expect(controller.openWorkspacePath(
        { path: '/workspace/report.txt' },
        abort.signal,
      )).rejects.toBe(reason)
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
