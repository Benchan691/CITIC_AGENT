/** Host registration for wallpaper settings, asset storage, and HTTP routes. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  deleteWallpaperAsset, findWallpaperAsset, MAX_WALLPAPER_BYTES, parseWallpaperMediaType,
  readWallpaperAsset, saveWallpaperAsset, WALLPAPER_HTTP_PREFIX, wallpaperAssetPath,
} from './asset-store.ts'
import {
  WALLPAPER_SETTINGS_NAMESPACE, WallpaperSettingsSchema,
} from './wallpaper-settings.ts'

export {
  BUILTIN_SURFACE_IDS, DEFAULT_SURFACE_CONFIG, resolveSurfaceConfig,
  WALLPAPER_FITS, WALLPAPER_SETTINGS_NAMESPACE, WallpaperSettingsSchema,
  type BuiltinSurfaceId, type WallpaperFit, type WallpaperSettings, type WallpaperSurfaceConfig,
} from './wallpaper-settings.ts'
export {
  MAX_WALLPAPER_BYTES, WALLPAPER_HTTP_PREFIX, wallpaperAssetPath,
} from './asset-store.ts'

const WALLPAPER_NAMESPACE = settingsNamespace(WALLPAPER_SETTINGS_NAMESPACE)

/**
 * Read the full request body into a Buffer.
 * @param req - incoming HTTP request.
 * @param limit - maximum accepted byte length.
 * @returns the body, or undefined when over the limit.
 */
async function readLimitedBody(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) continue
    const piece = Buffer.from(chunk)
    total += piece.length
    if (total > limit) return undefined
    chunks.push(piece)
  }
  return Buffer.concat(chunks, total)
}

/**
 * Write a JSON response.
 * @param res - HTTP response.
 * @param status - status code.
 * @param body - JSON-serializable body.
 */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
  })
  res.end(payload)
}

/**
 * Serve GET/DELETE for `/ui-wallpapers/<assetId>` and POST for `/ui-wallpapers`.
 * @param req - incoming request.
 * @param res - response to write.
 */
async function handleWallpaperHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const pathname = url.pathname
  const method = (req.method ?? 'GET').toUpperCase()

  if (pathname === WALLPAPER_HTTP_PREFIX || pathname === `${WALLPAPER_HTTP_PREFIX}/`) {
    if (method !== 'POST') {
      res.writeHead(405, { allow: 'POST' })
      res.end()
      return
    }
    const raw = await readLimitedBody(req, MAX_WALLPAPER_BYTES + 1024 * 256)
    if (raw === undefined) {
      sendJson(res, 413, { ok: false, error: 'payload-too-large' })
      return
    }
    let mediaType = parseWallpaperMediaType(req.headers['content-type'])
    let bytes = raw
    const contentType = req.headers['content-type'] ?? ''
    if (contentType.includes('application/json')) {
      let parsed: { mediaType?: string; data?: string }
      try {
        parsed = JSON.parse(raw.toString('utf8')) as { mediaType?: string; data?: string }
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid-json' })
        return
      }
      mediaType = parseWallpaperMediaType(parsed.mediaType)
      if (mediaType === undefined || typeof parsed.data !== 'string') {
        sendJson(res, 400, { ok: false, error: 'invalid-payload' })
        return
      }
      try {
        bytes = Buffer.from(parsed.data, 'base64')
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid-base64' })
        return
      }
    }
    if (mediaType === undefined) {
      sendJson(res, 415, { ok: false, error: 'unsupported-media-type' })
      return
    }
    if (bytes.length === 0 || bytes.length > MAX_WALLPAPER_BYTES) {
      sendJson(res, 413, { ok: false, error: 'payload-too-large' })
      return
    }
    const assetId = await saveWallpaperAsset(bytes, mediaType)
    sendJson(res, 200, { ok: true, assetId, url: wallpaperAssetPath(assetId) })
    return
  }

  if (!pathname.startsWith(`${WALLPAPER_HTTP_PREFIX}/`)) {
    res.writeHead(404)
    res.end()
    return
  }

  const assetId = pathname.slice(WALLPAPER_HTTP_PREFIX.length + 1)
  if (assetId.includes('/') || assetId.length === 0) {
    res.writeHead(404)
    res.end()
    return
  }

  if (method === 'GET' || method === 'HEAD') {
    const asset = await readWallpaperAsset(assetId)
    if (asset === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, {
      'content-type': asset.mediaType,
      'content-length': asset.bytes.length,
      'cache-control': 'private, max-age=31536000, immutable',
    })
    res.end(method === 'HEAD' ? undefined : asset.bytes)
    return
  }

  if (method === 'DELETE') {
    const removed = await deleteWallpaperAsset(assetId)
    // Confirm the id shape even when already gone so clients can clear settings.
    if (!removed && (await findWallpaperAsset(assetId)) === undefined && !/^[a-f0-9]{32}$/i.test(assetId)) {
      res.writeHead(404)
      res.end()
      return
    }
    sendJson(res, 200, { ok: true, removed })
    return
  }

  res.writeHead(405, { allow: 'GET, HEAD, DELETE' })
  res.end()
}

/**
 * Register the durable wallpaper section and asset HTTP routes when their
 * optional Host services are composed.
 * @param ctx - Host context that may acquire settings and HTTP services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(WALLPAPER_NAMESPACE, WallpaperSettingsSchema)
  })
  ctx.inject(['webServer'], (httpCtx) => {
    httpCtx.effect(
      () => httpCtx.webServer.register({
        kind: 'prefix',
        path: WALLPAPER_HTTP_PREFIX,
        handler: (req, res) => { void handleWallpaperHttp(req, res) },
      }),
      'client-ui-wallpaper: asset HTTP routes',
    )
  })
}
