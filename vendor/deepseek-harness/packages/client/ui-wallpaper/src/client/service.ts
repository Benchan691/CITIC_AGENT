/**
 * Client wallpaper service: surface registry, Host settings binding, and CSS
 * variable application for `[data-wallpaper-surface]` hosts.
 *
 * Painting uses layered host backgrounds and CSS variables only — never
 * positioning or injected overlays that could disturb sticky/fixed children.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ObservableSnapshot, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import {
  MAX_WALLPAPER_BYTES, parseWallpaperMediaType, wallpaperAssetPath, WALLPAPER_HTTP_PREFIX,
} from '../wallpaper-paths.ts'
import {
  DEFAULT_SURFACE_CONFIG, resolveSurfaceConfig,
  type WallpaperSettings, type WallpaperSurfaceConfig,
} from '../wallpaper-settings.ts'

const OVERLAY_STYLE_ID = 'dsh-ui-wallpaper-overlay-style'
const OVERLAY_CSS = `
[data-wallpaper-surface][data-wallpaper-active] {
  /* Paint on the host itself. A positioned pseudo-element would create a
     stacking context and trap fixed descendants such as the Settings panel. */
  background-image:
    linear-gradient(
      color-mix(in srgb, var(--dsw-alias-bg-base) calc(var(--ui-wallpaper-shade, 0.78) * 100%), transparent),
      color-mix(in srgb, var(--dsw-alias-bg-base) calc(var(--ui-wallpaper-shade, 0.78) * 100%), transparent)
    ),
    var(--ui-wallpaper-image);
  background-repeat: no-repeat, no-repeat;
  background-size: 100% 100%, var(--ui-wallpaper-fit, cover);
  background-position: 50% 50%, var(--ui-wallpaper-position, 50% 50%);
}
`

/**
 * Ensure the wallpaper overlay stylesheet is present once per document.
 */
function ensureOverlayStylesheet(): void {
  if (typeof document === 'undefined') return
  const existing = document.getElementById(OVERLAY_STYLE_ID)
  if (existing !== null) {
    existing.textContent = OVERLAY_CSS
    return
  }
  const style = document.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.setAttribute('data-plugin', '@deepseek-ai/dsh-client-ui-wallpaper')
  style.textContent = OVERLAY_CSS
  document.head.appendChild(style)
}

/** Registration describing one wallpaperable UI surface. */
export interface WallpaperSurfaceRegistration {
  /** Stable surface id (matches settings keys and `data-wallpaper-surface`). */
  id: string
  /** Locale key under the wallpaper settings namespace, or a literal label. */
  label: string
}

/** Stable presentation snapshot consumed by the settings card. */
export interface WallpaperSnapshot {
  /** Registered surfaces in picker order. */
  surfaces: readonly WallpaperSurfaceRegistration[]
  /** Optimistic per-surface settings. */
  configs: Record<string, WallpaperSurfaceConfig>
  /** Whether the current Host accepts changes. */
  writable: boolean
}

/** Public face other UI plugins call through `ctx.wallpaper`. */
export interface IWallpaper extends ObservableSnapshot<WallpaperSnapshot> {
  /**
   * Register a surface for the settings picker.
   * @param registration - surface id and label.
   * @returns disposer removing the registration.
   */
  registerSurface(registration: WallpaperSurfaceRegistration): () => void
  /** Snapshot of currently registered surfaces (registration order). */
  listSurfaces(): readonly WallpaperSurfaceRegistration[]
  /**
   * Subscribe to surface-registry changes.
   * @param listener - invoked after register/dispose.
   * @returns disposer.
   */
  subscribeSurfaces(listener: () => void): () => void
  /**
   * Persist one surface's configuration.
   * @param surfaceId - target surface.
   * @param config - full surface config to store.
   */
  setSurfaceConfig(surfaceId: string, config: WallpaperSurfaceConfig): Promise<void>
  /**
   * Clear one surface's stored configuration (and optionally delete its asset).
   * @param surfaceId - target surface.
   * @param deleteAsset - when true, DELETE the Host asset when present.
   */
  clearSurface(surfaceId: string, deleteAsset?: boolean): Promise<void>
  /**
   * Upload image bytes to the Host asset store.
   * @param blob - cropped/encoded image blob.
   * @returns asset id and public URL path.
   */
  uploadAsset(blob: Blob): Promise<{ assetId: string; url: string }>
  /**
   * Resolve the public URL for a stored asset id.
   * @param assetId - durable asset id.
   */
  assetUrl(assetId: string): string
  /** Read the live settings snapshot surfaces map. */
  getSurfaces(): Record<string, WallpaperSurfaceConfig>
  /** Whether the Host settings document accepts writes (loopback). */
  isWritable(): boolean
  /**
   * Subscribe to Host settings snapshot changes.
   * @param listener - invoked after each snapshot publication.
   * @returns disposer.
   */
  subscribeSettings(listener: () => void): () => void
}

/**
 * Strip leftover DOM mutations from earlier wallpaper painters.
 * @param host - surface host element.
 */
function sanitizeHost(host: HTMLElement): void {
  host.querySelectorAll(':scope > [data-wallpaper-overlay]').forEach((node) => { node.remove() })
  // Inline position from the previous painter overrides sticky CSS — clear it.
  if (host.style.position === 'relative') host.style.removeProperty('position')
}

/**
 * Apply or clear wallpaper CSS variables on every matching surface host.
 * @param surfaceId - `data-wallpaper-surface` value.
 * @param config - resolved config, or undefined to clear.
 */
function clearHost(host: HTMLElement): void {
  host.removeAttribute('data-wallpaper-active')
  host.style.removeProperty('--ui-wallpaper-image')
  host.style.removeProperty('--ui-wallpaper-fit')
  host.style.removeProperty('--ui-wallpaper-position')
  host.style.removeProperty('--ui-wallpaper-shade')
}

/**
 * @returns whether at least one matching host is actively painted.
 */
function paintSurface(surfaceId: string, config: WallpaperSurfaceConfig | undefined): boolean {
  const hosts = [...document.querySelectorAll<HTMLElement>('[data-wallpaper-surface]')]
    .filter(host => host.getAttribute('data-wallpaper-surface') === surfaceId)
  let painted = false
  for (const host of hosts) {
    sanitizeHost(host)
    const assetId = config?.assetId
    const active = config !== undefined
      && config.enabled
      && typeof assetId === 'string'
      && assetId.length > 0
    if (!active) {
      clearHost(host)
      continue
    }
    const resolved = resolveSurfaceConfig(config)
    const url = wallpaperAssetPath(assetId)
    const shade = 1 - resolved.opacity * (1 - resolved.scrim)
    host.setAttribute('data-wallpaper-active', '')
    host.style.setProperty('--ui-wallpaper-image', `url(${JSON.stringify(url)})`)
    host.style.setProperty('--ui-wallpaper-shade', String(shade))
    host.style.setProperty(
      '--ui-wallpaper-fit',
      resolved.fit === 'fill' ? '100% 100%' : resolved.fit,
    )
    host.style.setProperty(
      '--ui-wallpaper-position',
      `${resolved.position.x}% ${resolved.position.y}%`,
    )
    painted = true
  }
  return painted
}

/**
 * Runtime that binds Host wallpaper settings to DOM surface hosts.
 */
export class WallpaperRuntime implements IWallpaper {
  private readonly surfaces = new Map<string, WallpaperSurfaceRegistration[]>()
  private readonly surfaceListeners = new Set<() => void>()
  private readonly viewListeners = new Set<() => void>()
  private readonly paintedIds = new Set<string>()
  private readonly pendingAssetDeletes = new Set<string>()
  private readonly uploadedAssets = new Set<string>()
  private observer: MutationObserver | undefined
  private applyTimer: number | undefined
  private optimisticSurfaces: Record<string, WallpaperSurfaceConfig> | undefined
  private writeGeneration = 0
  private snapshot: WallpaperSnapshot

  /**
   * @param ctx - client context (for dispose/effects).
   * @param host - bound settings scope for `ui-wallpaper`.
   */
  constructor(
    private readonly ctx: Context,
    private readonly host: SettingsScope<WallpaperSettings>,
  ) {
    this.snapshot = this.buildSnapshot()
    ensureOverlayStylesheet()
    this.ctx.effect(() => this.host.subscribe(() => {
      if (this.optimisticSurfaces === undefined) this.publish()
    }), 'ui-wallpaper: settings → DOM')
    this.ctx.effect(() => {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return () => {}
      }
      // Surface roots are commonly mounted after the plugin starts (session
      // switches and HMR), so child additions must repaint too.
      this.observer = new MutationObserver(() => { this.scheduleApply() })
      this.observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        childList: true,
        attributeFilter: ['data-wallpaper-surface'],
      })
      this.scheduleApply()
      return () => {
        this.observer?.disconnect()
        this.observer = undefined
        if (this.applyTimer !== undefined) {
          window.clearTimeout(this.applyTimer)
          this.applyTimer = undefined
        }
        for (const host of document.querySelectorAll<HTMLElement>('[data-wallpaper-active]')) clearHost(host)
        this.paintedIds.clear()
        document.getElementById(OVERLAY_STYLE_ID)?.remove()
      }
    }, 'ui-wallpaper: DOM observer')
  }

  registerSurface(registration: WallpaperSurfaceRegistration): () => void {
    const registrations = this.surfaces.get(registration.id) ?? []
    registrations.push(registration)
    this.surfaces.set(registration.id, registrations)
    this.emitSurfaces()
    this.publish()
    return () => {
      const current = this.surfaces.get(registration.id)
      const index = current?.indexOf(registration) ?? -1
      if (current !== undefined && index >= 0) {
        current.splice(index, 1)
        if (current.length === 0) this.surfaces.delete(registration.id)
        this.emitSurfaces()
        this.publish()
      }
    }
  }

  listSurfaces(): readonly WallpaperSurfaceRegistration[] {
    return [...this.surfaces.values()].flatMap((registrations) => {
      const latest = registrations.at(-1)
      return latest === undefined ? [] : [latest]
    })
  }

  subscribeSurfaces(listener: () => void): () => void {
    this.surfaceListeners.add(listener)
    return () => { this.surfaceListeners.delete(listener) }
  }

  getSurfaces(): Record<string, WallpaperSurfaceConfig> {
    return this.optimisticSurfaces ?? this.host.getSnapshot().value?.surfaces ?? {}
  }

  isWritable(): boolean {
    return this.host.getSnapshot().writable
  }

  subscribeSettings(listener: () => void): () => void {
    return this.host.subscribe(listener)
  }

  getSnapshot(): WallpaperSnapshot {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.viewListeners.add(listener)
    return () => { this.viewListeners.delete(listener) }
  }

  async setSurfaceConfig(surfaceId: string, config: WallpaperSurfaceConfig): Promise<void> {
    const current = this.getSurfaces()
    const previousAsset = current[surfaceId]?.assetId
    const resolved = resolveSurfaceConfig(config)
    if (previousAsset && previousAsset !== resolved.assetId) this.pendingAssetDeletes.add(previousAsset)
    const next = { ...current, [surfaceId]: resolved }
    const generation = ++this.writeGeneration
    this.optimisticSurfaces = next
    this.publish()
    await this.host.set('surfaces', next)
    if (generation !== this.writeGeneration) return
    this.optimisticSurfaces = undefined
    const accepted = this.host.getSnapshot().value?.surfaces ?? {}
    await this.cleanupAssets(accepted)
    this.publish()
    if (!sameSurfaceConfig(accepted[surfaceId], resolved)) {
      throw new Error('wallpaper settings update was not accepted')
    }
  }

  async clearSurface(surfaceId: string, deleteAsset = true): Promise<void> {
    const current = this.getSurfaces()
    const previous = current[surfaceId]
    const { [surfaceId]: removed, ...next } = current
    void removed
    if (deleteAsset && previous?.assetId) this.pendingAssetDeletes.add(previous.assetId)
    const generation = ++this.writeGeneration
    this.optimisticSurfaces = next
    this.publish()
    await this.host.set('surfaces', next)
    if (generation !== this.writeGeneration) return
    this.optimisticSurfaces = undefined
    const accepted = this.host.getSnapshot().value?.surfaces ?? {}
    await this.cleanupAssets(accepted)
    this.publish()
    if (accepted[surfaceId] !== undefined) throw new Error('wallpaper settings clear was not accepted')
  }

  async uploadAsset(blob: Blob): Promise<{ assetId: string; url: string }> {
    const mediaType = blob.type || 'image/png'
    if (blob.size === 0 || blob.size > MAX_WALLPAPER_BYTES) throw new Error('wallpaper upload size is invalid')
    if (parseWallpaperMediaType(mediaType) === undefined) throw new Error('wallpaper upload type is unsupported')
    const response = await fetch(WALLPAPER_HTTP_PREFIX, {
      method: 'POST',
      headers: { 'content-type': mediaType },
      body: blob,
    })
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json() as { error?: string }
        if (typeof body.error === 'string') detail = `: ${body.error}`
      } catch {
        // ignore non-JSON error bodies
      }
      throw new Error(`wallpaper upload failed (${response.status}${detail})`)
    }
    const body = await response.json() as { ok?: boolean; assetId?: string; url?: string }
    if (!body.ok || typeof body.assetId !== 'string' || typeof body.url !== 'string') {
      throw new Error('wallpaper upload returned an invalid payload')
    }
    this.uploadedAssets.add(body.assetId)
    return { assetId: body.assetId, url: body.url }
  }

  assetUrl(assetId: string): string {
    return wallpaperAssetPath(assetId)
  }

  private emitSurfaces(): void {
    for (const listener of this.surfaceListeners) listener()
  }

  private buildSnapshot(): WallpaperSnapshot {
    return {
      surfaces: this.listSurfaces(),
      configs: this.getSurfaces(),
      writable: this.isWritable(),
    }
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot()
    for (const listener of this.viewListeners) listener()
    this.scheduleApply()
  }

  private async cleanupAssets(configs: Record<string, WallpaperSurfaceConfig>): Promise<void> {
    const used = new Set(Object.values(configs).flatMap(config => config.assetId ? [config.assetId] : []))
    for (const id of used) this.uploadedAssets.delete(id)
    const unused = [...this.pendingAssetDeletes, ...this.uploadedAssets].filter(id => !used.has(id))
    for (const id of unused) {
      try {
        await fetch(wallpaperAssetPath(id), { method: 'DELETE' })
      } catch {
        // Best-effort: settings are already authoritative.
      }
      this.pendingAssetDeletes.delete(id)
      this.uploadedAssets.delete(id)
    }
  }

  private scheduleApply(): void {
    if (typeof window === 'undefined') return
    if (this.applyTimer !== undefined) window.clearTimeout(this.applyTimer)
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = undefined
      this.applyAll()
    }, 0)
  }

  private applyAll(): void {
    if (typeof document === 'undefined') return
    ensureOverlayStylesheet()
    for (const host of document.querySelectorAll<HTMLElement>('[data-wallpaper-active]:not([data-wallpaper-surface])')) {
      clearHost(host)
    }
    const configs = this.getSurfaces()
    const ids = new Set<string>([
      ...Object.keys(configs),
      ...this.surfaces.keys(),
      ...this.paintedIds,
      ...[...document.querySelectorAll<HTMLElement>('[data-wallpaper-active][data-wallpaper-surface]')]
        .flatMap((host) => {
          const id = host.getAttribute('data-wallpaper-surface')
          return id === null ? [] : [id]
        }),
    ])
    for (const id of ids) {
      const config = configs[id]
      if (paintSurface(id, config?.assetId ? resolveSurfaceConfig(config) : undefined)) this.paintedIds.add(id)
      else this.paintedIds.delete(id)
    }
  }
}

function sameSurfaceConfig(
  left: WallpaperSurfaceConfig | undefined,
  right: WallpaperSurfaceConfig,
): boolean {
  return left !== undefined
    && left.assetId === right.assetId
    && left.opacity === right.opacity
    && left.scrim === right.scrim
    && left.fit === right.fit
    && left.position.x === right.position.x
    && left.position.y === right.position.y
    && left.enabled === right.enabled
}

export { DEFAULT_SURFACE_CONFIG, resolveSurfaceConfig }
