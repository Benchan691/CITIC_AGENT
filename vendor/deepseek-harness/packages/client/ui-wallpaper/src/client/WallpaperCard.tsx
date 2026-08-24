/**
 * Wallpaper settings card: surface picker, upload/crop, opacity, scrim, fit,
 * position, live preview, and clear.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  BUILTIN_SURFACE_IDS, resolveSurfaceConfig, SURFACE_ASPECT,
  WALLPAPER_FITS, type WallpaperFit, type WallpaperSurfaceConfig,
} from '../wallpaper-settings.ts'
import { MAX_WALLPAPER_BYTES } from '../wallpaper-paths.ts'
import {
  clampCropState, coverScale, exportCroppedBlob, loadImageFile, type CropState,
} from './crop.ts'
import type { WallpaperSnapshot, WallpaperSurfaceRegistration } from './service.ts'
import type { WallpaperKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import css from './WallpaperCard.module.css'

/** Injected face for the wallpaper settings card. */
export interface WallpaperCardInjected {
  hooks: {
    /** Reactive settings and surface registry snapshot. */
    wallpaper: ObservableSnapshot<WallpaperSnapshot>
  }
  /** Resolve one stored image URL. */
  assetUrl: (assetId: string) => string
  /** Persist a full surface configuration. */
  setSurfaceConfig: (surfaceId: string, config: WallpaperSurfaceConfig) => Promise<void>
  /** Remove a surface configuration and optionally its image. */
  clearSurface: (surfaceId: string, deleteAsset?: boolean) => Promise<void>
  /** Upload image bytes. */
  uploadAsset: (blob: Blob) => Promise<{ assetId: string; url: string }>
}

/** Props the renderer binds for the wallpaper card. */
export type WallpaperCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.wallpaper'>
  & InjectFace<WallpaperCardInjected>

const CROP_WIDTH = 360

/**
 * Format a 0–100 percent for display.
 * @param t - locale reader.
 * @param value - percent integer.
 */
function percentLabel(t: (key: WallpaperKey) => string, value: number): string {
  return t('percent').replace('{value}', String(value))
}

/**
 * Render the wallpaper settings card.
 * @param props - locale, runtime, and wallpaper face.
 * @returns the card.
 */
export function WallpaperCard(props: WallpaperCardProps) {
  const { t } = props
  const wallpaper = props.useWallpaper(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_SURFACE_IDS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [crop, setCrop] = useState<{
    image: HTMLImageElement
    objectUrl: string
    file: File
    state: CropState
  } | undefined>()
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | undefined>(undefined)
  const cropUrl = useRef<string | undefined>(undefined)

  useEffect(() => () => {
    if (cropUrl.current) URL.revokeObjectURL(cropUrl.current)
  }, [])

  const discardCrop = useCallback(() => {
    if (cropUrl.current) URL.revokeObjectURL(cropUrl.current)
    cropUrl.current = undefined
    drag.current = undefined
    setCrop(undefined)
  }, [])

  const writable = wallpaper.writable

  const surfaces = useMemo(() => {
    const registered = wallpaper.surfaces
    if (registered.length > 0) return registered
    return BUILTIN_SURFACE_IDS.map((id): WallpaperSurfaceRegistration => ({
      id,
      label: `surface.${id}`,
    }))
  }, [wallpaper.surfaces])

  useEffect(() => {
    if (!surfaces.some(surface => surface.id === selectedId) && surfaces[0]) {
      setSelectedId(surfaces[0].id)
    }
  }, [surfaces, selectedId])

  const config = resolveSurfaceConfig(wallpaper.configs[selectedId])
  const aspect = (SURFACE_ASPECT as Partial<Record<string, number>>)[selectedId] ?? (16 / 10)
  const cropHeight = Math.round(CROP_WIDTH / aspect)

  const surfaceLabel = (surface: WallpaperSurfaceRegistration): string => {
    const key = surface.label as WallpaperKey
    const translated = t(key)
    return translated === key ? surface.label : translated
  }

  const patch = useCallback(async (next: WallpaperSurfaceConfig) => {
    if (!wallpaper.writable) return false
    setError(undefined)
    try {
      await props.setSurfaceConfig(selectedId, next)
      return true
    } catch {
      setError(t('error.save'))
      return false
    }
  }, [props.setSurfaceConfig, selectedId, t, wallpaper.writable])

  const applyUpload = async (blob: Blob, extras?: Partial<WallpaperSurfaceConfig>) => {
    setBusy(true)
    setError(undefined)
    try {
      const uploaded = await props.uploadAsset(blob)
      const saved = await patch({
        ...config,
        assetId: uploaded.assetId,
        enabled: true,
        position: { x: 50, y: 50 },
        fit: 'cover',
        ...extras,
      })
      if (saved) discardCrop()
    } catch {
      setError(t('error.upload'))
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (file === undefined || !wallpaper.writable) return
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setError(t('error.type'))
      return
    }
    if (file.size === 0 || file.size > MAX_WALLPAPER_BYTES) {
      setError(t('error.size'))
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const loaded = await loadImageFile(file)
      if (cropUrl.current) URL.revokeObjectURL(cropUrl.current)
      cropUrl.current = loaded.objectUrl
      setCrop({
        image: loaded.image,
        objectUrl: loaded.objectUrl,
        file,
        state: {
          naturalWidth: loaded.image.naturalWidth,
          naturalHeight: loaded.image.naturalHeight,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        },
      })
    } catch {
      setError(t('error.upload'))
    } finally {
      setBusy(false)
    }
  }

  const confirmCrop = async () => {
    if (crop === undefined || !wallpaper.writable) return
    try {
      const blob = await exportCroppedBlob(crop.image, crop.state, CROP_WIDTH, cropHeight)
      await applyUpload(blob)
    } catch {
      setError(t('error.upload'))
    }
  }

  const useOriginal = async () => {
    if (crop === undefined || !wallpaper.writable) return
    await applyUpload(crop.file)
  }

  const clear = async () => {
    if (!wallpaper.writable) return
    setBusy(true)
    setError(undefined)
    try {
      await props.clearSurface(selectedId, true)
    } catch {
      setError(t('error.save'))
    } finally {
      setBusy(false)
    }
  }

  const previewUrl = config.assetId ? props.assetUrl(config.assetId) : undefined
  const fitCss = config.fit === 'fill' ? '100% 100%' : config.fit

  const cropStyle = (() => {
    if (crop === undefined) return undefined
    const base = coverScale(crop.state.naturalWidth, crop.state.naturalHeight, CROP_WIDTH, cropHeight)
    const scale = base * crop.state.scale
    const width = crop.state.naturalWidth * scale
    const height = crop.state.naturalHeight * scale
    return {
      width: `${(width / CROP_WIDTH) * 100}%`,
      height: `${(height / cropHeight) * 100}%`,
      left: `${(((CROP_WIDTH - width) / 2 + crop.state.offsetX) / CROP_WIDTH) * 100}%`,
      top: `${(((cropHeight - height) / 2 + crop.state.offsetY) / cropHeight) * 100}%`,
    }
  })()

  return (
    <li className={clsx(css.card, open && css.cardOpen)}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('card.title')}`}
        onClick={() => { setOpen(value => !value) }}
      >
        <span className={css.head}>
          <span className={css.title}>{t('card.title')}</span>
          <span className={css.description}>{t('card.description')}</span>
        </span>
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>
      {open ? <div className={css.body}>
        {!writable ? <p className={css.hint} role="status">{t('readOnly')}</p> : null}

        <div className={css.row}>
          <label className={css.label} htmlFor="wallpaper-surface">{t('surface.label')}</label>
          <select
            id="wallpaper-surface"
            className={css.select}
            value={selectedId}
            disabled={busy}
            onChange={(event) => {
              discardCrop()
              setError(undefined)
              setSelectedId(event.target.value)
            }}
          >
            {surfaces.map(surface => (
              <option key={surface.id} value={surface.id}>{surfaceLabel(surface)}</option>
            ))}
          </select>
        </div>

        <label className={css.checkRow}>
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={!writable || busy || !config.assetId}
            onChange={(event) => { void patch({ ...config, enabled: event.target.checked }) }}
          />
          {t('enabled')}
        </label>

        <div className={css.editorGrid}>
          <div className={css.row}>
            <span className={css.label}>{t('preview')}</span>
            <div
              className={css.preview}
              style={{
                aspectRatio: String(aspect),
                width: aspect < 1 ? `min(100%, ${Math.round(420 * aspect)}px)` : '100%',
              }}
              role={previewUrl ? 'img' : undefined}
              aria-label={previewUrl ? t('preview') : undefined}
            >
              {previewUrl
                ? (
                  <>
                    <div
                      className={css.previewImage}
                      style={{
                        backgroundImage: `url(${JSON.stringify(previewUrl)})`,
                        backgroundSize: fitCss,
                        backgroundPosition: `${config.position.x}% ${config.position.y}%`,
                        opacity: config.opacity,
                      }}
                    />
                    <div
                      className={css.previewScrim}
                      style={{ opacity: config.scrim }}
                    />
                  </>
                )
                : <span className={css.previewEmpty}>{t('upload')}</span>}
            </div>
          </div>

          <div className={css.tuning}>
            <div className={css.row}>
              <div className={css.labelRow}>
                <label className={css.label} htmlFor="wallpaper-opacity">{t('opacity')}</label>
                <span className={css.value}>{percentLabel(t, Math.round(config.opacity * 100))}</span>
              </div>
              <input
                id="wallpaper-opacity"
                className={css.range}
                type="range"
                min={5}
                max={100}
                value={Math.round(config.opacity * 100)}
                disabled={!writable || busy || !config.assetId}
                onChange={(event) => {
                  void patch({ ...config, opacity: Number(event.target.value) / 100 })
                }}
              />
            </div>

            <div className={css.row}>
              <div className={css.labelRow}>
                <label className={css.label} htmlFor="wallpaper-scrim">{t('scrim')}</label>
                <span className={css.value}>{percentLabel(t, Math.round(config.scrim * 100))}</span>
              </div>
              <input
                id="wallpaper-scrim"
                className={css.range}
                type="range"
                min={0}
                max={90}
                value={Math.round(config.scrim * 100)}
                disabled={!writable || busy || !config.assetId}
                onChange={(event) => {
                  void patch({ ...config, scrim: Number(event.target.value) / 100 })
                }}
              />
              <p className={css.hint}>{t('scrim.hint')}</p>
            </div>

            <div className={css.row}>
              <label className={css.label} htmlFor="wallpaper-fit">{t('fit')}</label>
              <select
                id="wallpaper-fit"
                className={css.select}
                value={config.fit}
                disabled={!writable || busy || !config.assetId}
                onChange={(event) => {
                  void patch({ ...config, fit: event.target.value as WallpaperFit })
                }}
              >
                {WALLPAPER_FITS.map(fit => (
                  <option key={fit} value={fit}>{t(`fit.${fit === 'fill' ? 'fill' : fit}`)}</option>
                ))}
              </select>
            </div>

            <div className={css.row}>
              <div className={css.labelRow}>
                <label className={css.label} htmlFor="wallpaper-pos-x">{t('position.x')}</label>
                <span className={css.value}>{percentLabel(t, Math.round(config.position.x))}</span>
              </div>
              <input
                id="wallpaper-pos-x"
                className={css.range}
                type="range"
                min={0}
                max={100}
                value={config.position.x}
                disabled={!writable || busy || !config.assetId}
                onChange={(event) => {
                  void patch({
                    ...config,
                    position: { ...config.position, x: Number(event.target.value) },
                  })
                }}
              />
            </div>
            <div className={css.row}>
              <div className={css.labelRow}>
                <label className={css.label} htmlFor="wallpaper-pos-y">{t('position.y')}</label>
                <span className={css.value}>{percentLabel(t, Math.round(config.position.y))}</span>
              </div>
              <input
                id="wallpaper-pos-y"
                className={css.range}
                type="range"
                min={0}
                max={100}
                value={config.position.y}
                disabled={!writable || busy || !config.assetId}
                onChange={(event) => {
                  void patch({
                    ...config,
                    position: { ...config.position, y: Number(event.target.value) },
                  })
                }}
              />
            </div>
          </div>
        </div>

        {crop
          ? (
            <div className={css.row}>
              <p className={css.hint}>{t('crop.hint')}</p>
              <div
                className={css.cropStage}
                style={{ width: Math.min(CROP_WIDTH, 420 * aspect), aspectRatio: String(aspect) }}
                role="group"
                aria-label={t('crop.stage')}
                tabIndex={0}
                onPointerDown={(event) => {
                  event.preventDefault()
                  if (typeof event.currentTarget.setPointerCapture === 'function') {
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }
                  drag.current = {
                    x: event.clientX,
                    y: event.clientY,
                    ox: crop.state.offsetX,
                    oy: crop.state.offsetY,
                  }
                }}
                onPointerMove={(event) => {
                  const activeDrag = drag.current
                  if (activeDrag === undefined) return
                  const ratio = CROP_WIDTH / event.currentTarget.getBoundingClientRect().width
                  const dx = (event.clientX - activeDrag.x) * ratio
                  const dy = (event.clientY - activeDrag.y) * ratio
                  setCrop(current => current && ({
                    ...current,
                    state: clampCropState({
                      ...current.state,
                      offsetX: activeDrag.ox + dx,
                      offsetY: activeDrag.oy + dy,
                    }, CROP_WIDTH, cropHeight),
                  }))
                }}
                onPointerUp={(event) => {
                  drag.current = undefined
                  if (typeof event.currentTarget.hasPointerCapture === 'function'
                  && event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                }}
                onPointerCancel={() => { drag.current = undefined }}
                onWheel={(event) => {
                  event.preventDefault()
                  const delta = event.deltaY > 0 ? 0.9 : 1.1
                  setCrop(current => current && ({
                    ...current,
                    state: clampCropState({
                      ...current.state,
                      scale: current.state.scale * delta,
                    }, CROP_WIDTH, cropHeight),
                  }))
                }}
                onKeyDown={(event) => {
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8],
                  }
                  const move = moves[event.key]
                  const zoom = event.key === '+' || event.key === '=' ? 1.1
                    : event.key === '-' || event.key === '_' ? 0.9 : undefined
                  if (move === undefined && zoom === undefined) return
                  event.preventDefault()
                  setCrop(current => current && ({
                    ...current,
                    state: clampCropState({
                      ...current.state,
                      offsetX: current.state.offsetX + (move?.[0] ?? 0),
                      offsetY: current.state.offsetY + (move?.[1] ?? 0),
                      scale: current.state.scale * (zoom ?? 1),
                    }, CROP_WIDTH, cropHeight),
                  }))
                }}
              >
                <img
                  className={css.cropImage}
                  src={crop.objectUrl}
                  alt=""
                  draggable={false}
                  style={cropStyle}
                />
              </div>
              <div className={css.row}>
                <div className={css.labelRow}>
                  <label className={css.label} htmlFor="wallpaper-crop-zoom">{t('crop.zoom')}</label>
                  <span className={css.value}>{Math.round(crop.state.scale * 100)}%</span>
                </div>
                <input
                  id="wallpaper-crop-zoom"
                  className={css.range}
                  type="range"
                  min={100}
                  max={400}
                  value={Math.round(crop.state.scale * 100)}
                  disabled={busy}
                  onChange={(event) => {
                    setCrop(current => current && ({
                      ...current,
                      state: clampCropState({
                        ...current.state,
                        scale: Number(event.target.value) / 100,
                      }, CROP_WIDTH, cropHeight),
                    }))
                  }}
                />
              </div>
              <div className={css.controls}>
                <button type="button" className={css.buttonPrimary} disabled={busy} onClick={() => { void confirmCrop() }}>
                  {busy ? t('busy') : t('crop.confirm')}
                </button>
                <button type="button" className={css.button} disabled={busy} onClick={() => { void useOriginal() }}>
                  {t('upload.direct')}
                </button>
                <button
                  type="button"
                  className={css.button}
                  disabled={busy}
                  onClick={() => {
                    discardCrop()
                  }}
                >
                  {t('crop.cancel')}
                </button>
              </div>
            </div>
          )
          : (
            <div className={css.controls}>
              <label
                className={clsx(css.buttonPrimary, (!writable || busy) && css.disabled)}
                aria-disabled={!writable || busy}
              >
                {t('upload')}
                <input
                  className={css.file}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={!writable || busy}
                  onChange={(event) => {
                    void onFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                className={css.button}
                disabled={!writable || busy || !config.assetId}
                onClick={() => { void clear() }}
              >
                {t('clear')}
              </button>
            </div>
          )}

        {error ? <p className={css.error} role="alert">{error}</p> : null}
        {busy && crop === undefined ? <p className={css.status}>{t('busy')}</p> : null}
      </div> : null}
    </li>
  )
}
