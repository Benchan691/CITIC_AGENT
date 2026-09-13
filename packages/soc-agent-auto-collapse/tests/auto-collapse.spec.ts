import { Context } from '@deepseek-ai/cordis'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, inject } from 'dsh-soc-agent-auto-collapse/client'
import { SOC_AUTO_COLLAPSE_NAMESPACE } from 'dsh-soc-agent-auto-collapse'

const owners: Array<{ dispose(): Promise<void> }> = []

afterEach(async () => {
  for (const owner of owners.splice(0)) await owner.dispose()
})

async function mount(surface: 'workspace' | 'admin' = 'workspace') {
  const ctx = new Context()
  const settings = stubSettingsScope<{ enabled: boolean; statusText: string }>()
  ctx.provide('socClient', { surface, rpc: async () => ({}) } as never)
  ctx.provide('settingsScope', { bind: ({ namespace }: { namespace: string }) => {
    expect(namespace).toBe(SOC_AUTO_COLLAPSE_NAMESPACE)
    return settings.scope
  } } as never)
  const owner = ctx.plugin({ inject: [...inject], apply })
  owners.push(owner)
  await owner.await()
  return { ctx, owner, settings }
}

describe('dsh-soc-agent-auto-collapse client', () => {
  it('declares the core runtime and settings dependencies', () => {
    expect(inject).toEqual(['socClient', 'settingsScope'])
  })

  it('adopts persisted settings and unsubscribes on teardown', async () => {
    const b = await mount()
    const runtime = b.ctx.get('socAutoCollapse' as never) as {
      state: { getSnapshot(): { enabled: boolean; statusText: string } }
    }
    expect(runtime.state.getSnapshot()).toEqual({ enabled: true, statusText: 'Deep sleeping...' })
    expect(b.settings.listenerCount()).toBe(1)

    b.settings.publish({
      status: 'ready',
      value: { enabled: false, statusText: 'Paused' },
      revision: 4,
      writable: true,
    })
    expect(runtime.state.getSnapshot()).toEqual({ enabled: false, statusText: 'Paused' })

    await b.owner.dispose()
    owners.splice(owners.indexOf(b.owner), 1)
    expect(b.settings.listenerCount()).toBe(0)
  })

  it('does not expose workspace-only state on the admin surface', async () => {
    const b = await mount('admin')
    expect(b.settings.listenerCount()).toBe(0)
    expect(b.ctx.get('socAutoCollapse' as never)).toBeUndefined()
  })
})
