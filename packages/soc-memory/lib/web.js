// dsh-memory Web backend: the same-origin settings endpoint for the browser
// card. Kept dependency-free (node builtins only) so it can be unit-tested
// without the harness packages; the settings seam contract is structural.
// Conflicts are detected by the stable error code SETTINGS_CONFLICT, which
// the SettingsConflictError class carries.

/** Exact route used by the browser Settings card. */
export const MEMORY_SETTINGS_ROUTE = '/_dsh/memory/settings'

const SETTINGS_CONFLICT_CODE = 'SETTINGS_CONFLICT'

function settingsIsRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function redactMemoryEndpoint(value) {
  const raw = String(value ?? '').trim()
  if (raw.length === 0) return ''
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.hostname.length === 0) return '[configured endpoint]'
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return '[configured endpoint]'
  }
}

function redactMemorySettingsValue(value) {
  if (!settingsIsRecord(value)) return value
  const copy = { ...value }
  if (Object.hasOwn(copy, 'embeddingBaseURL')) copy.embeddingBaseURL = redactMemoryEndpoint(copy.embeddingBaseURL)
  return copy
}

function settingsResponseJson(res, status, body) {
  const bytes = Buffer.from(JSON.stringify(body))
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', String(bytes.length))
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.writeHead(status)
  res.end(bytes)
}

function settingsRequestError(res, status, code, message) {
  settingsResponseJson(res, status, { ok: false, error: { code, message } })
}

function settingsSameOriginPost(req) {
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none'
  const host = req.headers.host
  if (host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

async function settingsReadJson(req, maxBytes = 64 * 1024) {
  const contentType = String(req.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') throw new TypeError('Content-Type must be application/json')
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += part.length
    if (bytes > maxBytes) throw new RangeError(`request body exceeds ${maxBytes} bytes`)
    chunks.push(part)
  }
  if (chunks.length === 0) throw new TypeError('request body is empty')
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function parseSettingsRequest(value) {
  if (!settingsIsRecord(value) || typeof value.action !== 'string') throw new TypeError('request action is required')
  if (value.action === 'save') {
    if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) throw new TypeError('save.expectedRevision must be a non-negative integer')
    if (!settingsIsRecord(value.value)) throw new TypeError('save.value must be an object')
    return { action: 'save', expectedRevision: value.expectedRevision, value: value.value }
  }
  throw new TypeError(`unsupported action: ${value.action}`)
}

function settingsPublicMessage(error) {
  // Settings providers may include submitted values in their exception text.
  // The web route only needs a stable, non-sensitive diagnostic class.
  return 'Memory settings request failed'
}

function memorySecretMetadata(settings, descriptor) {
  const secrets = descriptor.secrets ?? []
  const rawDescriptor = settings.describe().find((row) => String(row.ns) === 'memory')
  const rawValue = rawDescriptor?.value
  const embeddingApiKey = settingsIsRecord(rawValue) ? rawValue.embeddingApiKey : undefined
  const embeddingConfigured = typeof embeddingApiKey === 'string' && embeddingApiKey.trim().length > 0
  return secrets.map((secret) => secret.path.length === 1 && secret.path[0] === 'embeddingApiKey'
    ? { ...secret, set: embeddingConfigured }
    : secret)
}

/** Read the memory namespace descriptor through the redacted settings seam. */
export function memorySettingsSnapshot(settings) {
  const descriptor = settings.describe({ redactSecrets: true }).find((row) => String(row.ns) === 'memory')
  if (descriptor === undefined) throw new Error('memory settings namespace is not registered')
  return {
    schemaVersion: 1,
    writable: settings.writable,
    settings: {
      value: redactMemorySettingsValue(descriptor.value),
      ...descriptor.base === undefined ? {} : { base: redactMemorySettingsValue(descriptor.base) },
      ...descriptor.user === undefined ? {} : { user: redactMemorySettingsValue(descriptor.user) },
      secrets: memorySecretMetadata(settings, descriptor),
      revision: descriptor.revision,
      applies: 'live'
    }
  }
}

/** Preserve a write-only secret when a redacted settings form saves other fields. */
function preserveOmittedMemorySecret(settings, value) {
  if (Object.prototype.hasOwnProperty.call(value, 'embeddingApiKey')) return value
  const descriptor = settings.describe().find((row) => String(row.ns) === 'memory')
  const user = descriptor?.user
  if (!settingsIsRecord(user) || !Object.prototype.hasOwnProperty.call(user, 'embeddingApiKey')) return value
  return { ...value, embeddingApiKey: user.embeddingApiKey }
}

/**
 * Same-origin settings endpoint for the Web plugin card. GET returns the
 * current snapshot; POST accepts `{ action: 'save', expectedRevision, value }`
 * and persists the section through the settings seam (conflict -> 409).
 * @param ctx - owning context; only `ctx.logger` is used.
 * @param settings - the settings provider face (`describe`, `replace`, `writable`).
 */
export function memorySettingsRouteHandler(ctx, settings) {
  return async function handleMemorySettings(req, res) {
    if (req.method === 'GET') {
      try {
        settingsResponseJson(res, 200, { ok: true, value: memorySettingsSnapshot(settings) })
      } catch (error) {
        ctx.logger.warn('dsh-memory settings snapshot failed: %s', settingsPublicMessage(error))
        settingsRequestError(res, 503, 'settings-unavailable', 'Memory settings are unavailable')
      }
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST')
      settingsRequestError(res, 405, 'method-not-allowed', 'Use GET or POST')
      return
    }
    if (!settingsSameOriginPost(req)) {
      settingsRequestError(res, 403, 'origin-rejected', 'The request must originate from this DSH Web application')
      return
    }
    let parsed
    try {
      parsed = parseSettingsRequest(await settingsReadJson(req))
    } catch (error) {
      settingsRequestError(res, error instanceof RangeError ? 413 : 400, 'invalid-request', settingsPublicMessage(error))
      return
    }
    try {
      if (!settings.writable) throw new Error('settings provider is read-only')
      await settings.replace('memory', preserveOmittedMemorySecret(settings, parsed.value), parsed.expectedRevision)
      settingsResponseJson(res, 200, { ok: true, value: memorySettingsSnapshot(settings) })
    } catch (error) {
      const conflict = typeof error === 'object' && error !== null && error.code === SETTINGS_CONFLICT_CODE
      ctx.logger.warn('dsh-memory settings save failed: %s', settingsPublicMessage(error))
      settingsRequestError(res, conflict ? 409 : 400, conflict ? 'settings-conflict' : 'settings-rejected', settingsPublicMessage(error))
    }
  }
}

/** Register the Web settings route once the optional Web server is available. */
export function installMemorySettingsWeb(ctx, settings) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: MEMORY_SETTINGS_ROUTE,
      handler: memorySettingsRouteHandler(ctx, settings)
    }), 'dsh-memory: settings route')
  })
}
