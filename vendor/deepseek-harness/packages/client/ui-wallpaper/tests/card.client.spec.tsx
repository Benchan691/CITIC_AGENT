// @vitest-environment jsdom
/** Wallpaper card interaction and accessibility regressions. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WallpaperCard, type WallpaperCardProps } from '../src/client/WallpaperCard.tsx'
import { en } from '../src/client/locales.ts'
import { MAX_WALLPAPER_BYTES } from '../src/wallpaper-paths.ts'
import type { WallpaperSnapshot } from '../src/client/service.ts'

const ASSET = 'a'.repeat(32)

function view(writable: boolean, withAsset = false): WallpaperSnapshot {
  return {
    writable,
    surfaces: [
      { id: 'shell', label: 'surface.shell' },
      { id: 'sidebar', label: 'surface.sidebar' },
    ],
    configs: withAsset
      ? {
        shell: {
          assetId: ASSET,
          opacity: 0.4,
          scrim: 0.55,
          fit: 'cover',
          position: { x: 50, y: 50 },
          enabled: true,
        },
      }
      : {},
  }
}

function mount(snapshot: WallpaperSnapshot, overrides: Partial<WallpaperCardProps> = {}) {
  const props = {
    t: ((key: keyof typeof en) => en[key]) as WallpaperCardProps['t'],
    useWallpaper: ((select: (state: WallpaperSnapshot) => unknown) => select(snapshot)) as WallpaperCardProps['useWallpaper'],
    useSessions: vi.fn() as never,
    useWorkspaces: vi.fn() as never,
    assetUrl: (id: string) => `/ui-wallpapers/${id}`,
    setSurfaceConfig: vi.fn(() => Promise.resolve()),
    clearSurface: vi.fn(() => Promise.resolve()),
    uploadAsset: vi.fn(() => Promise.resolve({ assetId: ASSET, url: `/ui-wallpapers/${ASSET}` })),
    ...overrides,
  } satisfies WallpaperCardProps
  return { props, ...render(<WallpaperCard {...props} />) }
}

afterEach(cleanup)

describe('WallpaperCard', () => {
  it('starts collapsed and exposes its controls through an accessible disclosure', () => {
    mount(view(true))
    expect(screen.queryByLabelText('Surface')).toBeNull()
    const disclosure = screen.getByRole('button', { name: 'Expand: UI backgrounds' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(disclosure)
    expect(screen.getByRole('button', { name: 'Collapse: UI backgrounds' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText('Surface')).toBeTruthy()
  })

  it('lets remote users inspect every surface while keeping mutations disabled', () => {
    mount(view(false, true))
    fireEvent.click(screen.getByRole('button', { name: 'Expand: UI backgrounds' }))

    const select = screen.getByLabelText('Surface') as HTMLSelectElement
    expect(select.disabled).toBe(false)
    fireEvent.change(select, { target: { value: 'sidebar' } })
    expect(select.value).toBe('sidebar')
    expect(screen.getByLabelText('Enable background').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Remote sessions cannot write wallpaper settings.')).toBeTruthy()
  })

  it('rejects oversized files before decoding or uploading them', () => {
    const uploadAsset = vi.fn(() => Promise.resolve({ assetId: ASSET, url: `/ui-wallpapers/${ASSET}` }))
    const { container } = mount(view(true), { uploadAsset })
    fireEvent.click(screen.getByRole('button', { name: 'Expand: UI backgrounds' }))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'too-large.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: MAX_WALLPAPER_BYTES + 1 })
    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByRole('alert').textContent).toBe('The image must be smaller than 5MB.')
    expect(uploadAsset).not.toHaveBeenCalled()
  })

  it('reports a failed settings write instead of failing silently', async () => {
    const setSurfaceConfig = vi.fn(() => Promise.reject(new Error('offline')))
    mount(view(true, true), { setSurfaceConfig })
    fireEvent.click(screen.getByRole('button', { name: 'Expand: UI backgrounds' }))
    fireEvent.change(screen.getByLabelText('Image opacity'), { target: { value: '80' } })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Could not save the wallpaper setting. Try again.')
    })
  })
})
