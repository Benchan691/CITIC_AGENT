// @vitest-environment jsdom
/** Wallpaper runtime regressions: late DOM mounts, registry lifetimes, and writes. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type {
  SettingsScope, SettingsScopeSnapshot,
} from '@deepseek-ai/dsh-client-runtime/client'
import { WallpaperRuntime } from '../src/client/service.ts'
import type { WallpaperSettings, WallpaperSurfaceConfig } from '../src/wallpaper-settings.ts'

const ASSET = 'a'.repeat(32)

function config(assetId = ASSET): WallpaperSurfaceConfig {
  return {
    assetId,
    opacity: 0.4,
    scrim: 0.5,
    fit: 'cover',
    position: { x: 50, y: 50 },
    enabled: true,
  }
}

function scopeOf(
  surfaces: Record<string, WallpaperSurfaceConfig>,
  acceptWrites = true,
): SettingsScope<WallpaperSettings> {
  const listeners = new Set<() => void>()
  let snapshot: SettingsScopeSnapshot<WallpaperSettings> = {
    status: 'ready',
    value: { surfaces },
    base: undefined,
    user: undefined,
    revision: 0,
    writable: true,
    mode: 'host',
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: async (_field, value) => {
      if (!acceptWrites) return
      snapshot = {
        ...snapshot,
        revision: (snapshot.revision ?? 0) + 1,
        value: { surfaces: value as Record<string, WallpaperSurfaceConfig> },
      }
      for (const listener of listeners) listener()
    },
    unset: async () => {},
  }
}

async function runtimeOf(scope: SettingsScope<WallpaperSettings>) {
  const ctx = new Context()
  let runtime!: WallpaperRuntime
  const fiber = ctx.plugin({
    apply(plugin) { runtime = new WallpaperRuntime(plugin, scope) },
  })
  await fiber.await()
  return { runtime, fiber }
}

async function flushPaint(): Promise<void> {
  await Promise.resolve()
  vi.runOnlyPendingTimers()
}

beforeEach(() => {
  vi.useFakeTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('WallpaperRuntime', () => {
  it('paints surfaces mounted after startup without creating a stacking context', async () => {
    const { fiber } = await runtimeOf(scopeOf({ shell: config() }))
    await flushPaint()

    const host = document.createElement('div')
    host.dataset.wallpaperSurface = 'shell'
    document.body.append(host)
    await flushPaint()

    expect(host.hasAttribute('data-wallpaper-active')).toBe(true)
    expect(host.style.getPropertyValue('--ui-wallpaper-image')).toContain(ASSET)
    expect(host.style.getPropertyValue('--ui-wallpaper-shade')).toBe('0.8')
    const sheet = document.getElementById('dsh-ui-wallpaper-overlay-style')?.textContent ?? ''
    expect(sheet).not.toContain('z-index')
    expect(sheet).not.toContain('::before')

    await fiber.dispose()
    expect(host.hasAttribute('data-wallpaper-active')).toBe(false)
  })

  it('clears stale paint when a host changes or loses its surface id', async () => {
    const { fiber } = await runtimeOf(scopeOf({ shell: config() }))
    const host = document.createElement('div')
    host.dataset.wallpaperSurface = 'shell'
    document.body.append(host)
    await flushPaint()
    expect(host.hasAttribute('data-wallpaper-active')).toBe(true)

    host.dataset.wallpaperSurface = 'unknown'
    await flushPaint()
    expect(host.hasAttribute('data-wallpaper-active')).toBe(false)

    host.dataset.wallpaperSurface = 'shell'
    await flushPaint()
    host.removeAttribute('data-wallpaper-surface')
    await flushPaint()
    expect(host.hasAttribute('data-wallpaper-active')).toBe(false)
    await fiber.dispose()
  })

  it('restores the previous registration when a duplicate is disposed', async () => {
    const { runtime, fiber } = await runtimeOf(scopeOf({}))
    const builtin = { id: 'shell', label: 'surface.shell' }
    const custom = { id: 'shell', label: 'Custom shell' }
    const offBuiltin = runtime.registerSurface(builtin)
    const offCustom = runtime.registerSurface(custom)
    expect(runtime.listSurfaces()).toEqual([custom])

    offCustom()
    expect(runtime.listSurfaces()).toEqual([builtin])
    offBuiltin()
    expect(runtime.listSurfaces()).toEqual([])
    await fiber.dispose()
  })

  it('publishes writes optimistically and rolls back a rejected save', async () => {
    const rejected = scopeOf({ shell: config() }, false)
    const { runtime, fiber } = await runtimeOf(rejected)
    const next = { ...config(), opacity: 0.9 }
    const write = runtime.setSurfaceConfig('shell', next)
    expect(runtime.getSnapshot().configs.shell?.opacity).toBe(0.9)
    await expect(write).rejects.toThrow('not accepted')
    expect(runtime.getSnapshot().configs.shell?.opacity).toBe(0.4)
    await fiber.dispose()
  })

  it('deletes a cleared image only after its final surface stops using it', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const { runtime, fiber } = await runtimeOf(scopeOf({ shell: config(), sidebar: config() }))

    await runtime.clearSurface('shell')
    expect(fetchMock).not.toHaveBeenCalled()
    await runtime.clearSurface('sidebar')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(`/ui-wallpapers/${ASSET}`, { method: 'DELETE' })
    await fiber.dispose()
  })
})
