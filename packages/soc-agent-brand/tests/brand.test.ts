import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from 'dsh-soc-agent-brand/client'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('socClient', {
    surface: 'workspace',
    rpc: async () => ({}),
  } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'conversation.hero.brand.mark': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, slots }
}

async function benchSurface(surface: 'workspace' | 'admin') {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('socClient', { surface, rpc: async () => ({}) } as never)
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({
    name: 'root',
    children: {
      'sidebar.brand.mark': { kind: 'single', scope: 'root' },
      'sidebar.brand.name': { kind: 'single', scope: 'root' },
      'conversation.hero.brand.mark': { kind: 'single', scope: 'root' },
    },
  } as never, () => null)
  return { ctx, slots }
}

describe('dsh-soc-agent-brand apply', () => {
  it('requires the mandatory SOC runtime contract', () => {
    expect(inject).toEqual(['slots', 'socClient'])
  })

  it('registers and removes all branding occupants with the feature lifecycle', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('sidebar.brand.mark')).toHaveLength(1)
    expect(b.slots.entries('sidebar.brand.name')).toHaveLength(1)
    expect(b.slots.entries('conversation.hero.brand.mark')).toHaveLength(1)
    await fiber.dispose()
    expect(b.slots.entries('sidebar.brand.mark')).toHaveLength(0)
    expect(b.slots.entries('sidebar.brand.name')).toHaveLength(0)
    expect(b.slots.entries('conversation.hero.brand.mark')).toHaveLength(0)
  })

  it('does not mount workspace branding on the admin surface', async () => {
    const b = await benchSurface('admin')
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('sidebar.brand.mark')).toHaveLength(0)
    expect(b.slots.entries('sidebar.brand.name')).toHaveLength(0)
    expect(b.slots.entries('conversation.hero.brand.mark')).toHaveLength(0)
    await fiber.dispose()
  })
})
