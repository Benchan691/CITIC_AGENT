/** ui-wallpaper apply wiring: service provision, dictionaries, settings card. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as applySettings, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  apply, inject, SETTINGS_NS, WALLPAPER_SETTINGS_NAMESPACE, WallpaperCard,
  WallpaperSettingsSchema,
} from '@deepseek-ai/dsh-client-ui-wallpaper/client'

usePinnedBrowserLanguages('zh-CN')

const SLOT = 'settings.plugin.item'

async function bench(isLoopback = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  let surfaces: Record<string, unknown> = {}
  const namespace = () => ({
    ns: WALLPAPER_SETTINGS_NAMESPACE,
    schema: WallpaperSettingsSchema.toJSON(),
    value: { surfaces },
    applies: 'live' as const,
    secrets: [],
    revision: 0,
  })
  const describeNs = vi.fn(() => Promise.resolve({
    rpcId: 'wallpaper-describe' as never,
    result: {
      ok: true as const,
      value: { writable: true, hasDocument: true, namespaces: [namespace()] },
    },
  }))
  const mutate = vi.fn((request: { ops: { value: unknown }[] }) => {
    surfaces = request.ops[0]!.value as Record<string, unknown>
    return Promise.resolve({
      rpcId: 'wallpaper-mutate' as never,
      result: { ok: true as const, value: namespace() },
    })
  })
  ctx.provide('connection', { api: { settings: { describe: describeNs, mutate } }, isLoopback } as never)
  new TestRemote(ctx)
  await ctx.plugin({ inject: [...settingsInject], apply: applySettings }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, mutate }
}

function declarePlugins(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'keyed', scope: 'root' } } } as never,
    () => null,
  )
}

describe('ui-wallpaper apply', () => {
  it('declares the required services', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope'])
  })

  it('provides wallpaper, registers copy, and seats the settings card', async () => {
    const before = await bench()
    declarePlugins(before.slots)
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    expect(before.ctx.get('wallpaper')).toBeDefined()
    expect(before.locale.bind(SETTINGS_NS)('card.title')).toBe('界面背景')
    before.locale.setLocale('en')
    expect(before.locale.bind(SETTINGS_NS)('card.title')).toBe('UI backgrounds')
    const entry = before.slots.entries(SLOT).find(e => e.component === WallpaperCard)
    expect(entry?.options).toMatchObject({ key: WALLPAPER_SETTINGS_NAMESPACE })
    expect(before.ctx.get('wallpaper')!.listSurfaces().map(s => s.id)).toEqual([
      'shell', 'sidebar', 'conversation',
    ])
  })

  it('disposes surface registrations and the card on unload', async () => {
    const b = await bench()
    declarePlugins(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries(SLOT).some(e => e.component === WallpaperCard)).toBe(true)
    await fiber.dispose()
    expect(b.slots.entries(SLOT).some(e => e.component === WallpaperCard)).toBe(false)
    expect(b.ctx.get('wallpaper')).toBeUndefined()
  })
})
