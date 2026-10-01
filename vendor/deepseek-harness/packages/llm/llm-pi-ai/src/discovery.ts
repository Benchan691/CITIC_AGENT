/**
 * Answering "which models can this provider serve?" for the configuration
 * surface's "fetch available models" action.
 *
 * A route the installed pi-ai catalog ships is answered **from that catalog**,
 * with no network call at all: pi-ai's registry is the authoritative list for
 * its own providers, and it carries the capacities a listing endpoint would
 * not disclose. Only a route the catalog does not describe — a gateway, a
 * self-hosted server — is interrogated over the wire.
 *
 * Neither path is a catalog refresh. Nothing here is stored: the request
 * carries a draft the user is still editing, and the reply is candidate
 * metadata the surface offers for adoption. `settings.yaml` remains the only
 * thing that decides what a route serves.
 *
 * A draft that has already named a protocol is asked with exactly one request,
 * shaped for that protocol. A draft that has not named one is probed across
 * the listing shapes gateways actually speak — OpenAI's `GET /models` with
 * bearer auth, then Anthropic's with `x-api-key` — and the first readable
 * listing wins, reported back with the protocol that produced it so the
 * surface can finish the draft's protocol field too.
 *
 * @module dsh-llm-pi-ai/discovery
 */

import { INVALID_CREDENTIAL_CODE, LlmError, normalizeApiKey } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel, LlmModelDiscoveryRequest, LlmModelDiscoveryResult } from '@deepseek-ai/dsh-llm'
import { attributionHeaders } from '@deepseek-ai/dsh-llm'
import { catalogModels } from './catalog.ts'

/**
 * Protocols whose model listing this module can read: the two that speak
 * OpenAI's `GET /models` shape with bearer auth, plus Anthropic Messages,
 * whose `GET /v1/models` listing shares the `data[]` reply shape. Azure is
 * absent despite its OpenAI lineage — it authenticates with an `api-key`
 * header and requires an `api-version` query — and Codex authenticates
 * through OAuth; guessing at either would report an authentication failure
 * as a provider with no models. pi-ai's remaining protocols are absent for
 * the same reason.
 */
const LISTABLE_PROTOCOLS: ReadonlySet<string> = new Set([
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
])

/** The `anthropic-version` header value model listings accept. */
const ANTHROPIC_VERSION = '2023-06-01'

/**
 * Endpoint replies larger than this are refused. The endpoint is whatever URL
 * the user typed, so the ceiling holds on the bytes actually read rather than
 * on the length the server claims — the same two-stage shape `dsh-web-fetch`
 * uses for its own caller-supplied URLs, except that a truncated model listing
 * is not parseable, so overflow rejects instead of truncating.
 */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024

/** One entry of an OpenAI- or Anthropic-compatible `GET …/models` reply. */
interface ListingEntry {
  id?: unknown
  /** Common gateway extensions; absent from the official listings. */
  name?: unknown
  display_name?: unknown
  context_window?: unknown
  context_length?: unknown
  max_tokens?: unknown
  max_output_tokens?: unknown
}

/** A positive integer field of a listing entry, or `undefined` when absent or unusable. */
function capacity(...candidates: readonly unknown[]): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) return candidate
  }
  return undefined
}

/** A non-empty string field of a listing entry, or `undefined`. */
function label(...candidates: readonly unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/**
 * The Anthropic listing endpoint for a base. Anthropic's protocol mounts under
 * `/v1`, so a base that names no version segment gets one; a base already
 * ending in `/v1` (or any `/vN`) is taken as the deployment root as-is.
 */
function anthropicListingUrl(baseURL: string): string {
  const base = baseURL.replace(/\/+$/, '')
  return /\/v\d+$/u.test(base) ? `${base}/models` : `${base}/v1/models`
}

/** One wire request this module knows how to read a listing from. */
interface ProbeCandidate {
  /** Protocol a readable reply confirms this endpoint speaking. */
  api: string
  url: string
  /** Header style: OpenAI's bearer token or Anthropic's `x-api-key` pair. */
  style: 'openai' | 'anthropic'
}

/**
 * The requests to try for one draft, in order. An explicit protocol is asked
 * with exactly its own single request — the caller pinned the shape, so one
 * honest answer (or failure) beats a silent fallback to another protocol.
 * Without one, the draft is probed across the plausible shapes: a base with no
 * version segment is tried with and without `/v1`, because half the gateways
 * in the wild mount OpenAI's API at the root and half under `/v1`.
 */
function probeCandidates(baseURL: string, api: string | undefined): ProbeCandidate[] {
  const base = baseURL.replace(/\/+$/, '')
  if (api !== undefined) {
    return api === 'anthropic-messages'
      ? [{ api, url: anthropicListingUrl(baseURL), style: 'anthropic' }]
      : [{ api, url: `${base}/models`, style: 'openai' }]
  }
  if (/\/v\d+$/u.test(base)) {
    return [
      { api: 'openai-completions', url: `${base}/models`, style: 'openai' },
      { api: 'anthropic-messages', url: `${base}/models`, style: 'anthropic' },
    ]
  }
  return [
    { api: 'openai-completions', url: `${base}/models`, style: 'openai' },
    { api: 'openai-completions', url: `${base}/v1/models`, style: 'openai' },
    { api: 'anthropic-messages', url: `${base}/v1/models`, style: 'anthropic' },
    { api: 'anthropic-messages', url: `${base}/models`, style: 'anthropic' },
  ]
}

/**
 * Read a reply body, refusing one that outgrows the ceiling. A declared length
 * is checked first so an honest server is turned away without transferring
 * anything; the accumulated total is what actually enforces the bound, because
 * a server that under-declares (or streams) tells us nothing up front.
 */
async function readBounded(response: Response, url: string): Promise<string> {
  const oversized = (): LlmError =>
    new LlmError(`${url} answered with more than ${MAX_RESPONSE_BYTES} bytes`, 'DISCOVERY_FAILED')
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel()
    throw oversized()
  }
  /* v8 ignore next -- fetch always exposes a body stream on a 2xx Response; the null guard is defensive. */
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) throw oversized()
      chunks.push(value)
    }
  } finally {
    /* v8 ignore next 4 -- cancel() after a completed or abandoned read settles without rejecting; unobserved best-effort cleanup. */
    await reader.cancel().catch(() => {
      // Cancel after a drained read, or after this function walked away from
      // an oversized one, is cleanup; the reply is already decided either way.
    })
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(body)
}

/**
 * Read one OpenAI- or Anthropic-compatible listing reply. Entries without a
 * usable id are skipped rather than failing the whole interrogation: a single
 * malformed row should not deny the user the rest of a working endpoint's
 * catalog.
 */
function readListing(body: unknown): LlmDiscoveredModel[] {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) {
    throw new LlmError(
      'the endpoint\'s model listing has no "data" array; enter this provider\'s models by hand',
      'DISCOVERY_FAILED',
    )
  }
  const models: LlmDiscoveredModel[] = []
  for (const raw of data) {
    const entry = raw as ListingEntry | null
    const id = label(entry?.id)
    if (id === undefined) continue
    const name = label(entry?.name, entry?.display_name)
    const contextWindow = capacity(entry?.context_window, entry?.context_length)
    const maxTokens = capacity(entry?.max_output_tokens, entry?.max_tokens)
    models.push({
      id,
      ...name === undefined ? {} : { name },
      ...contextWindow === undefined ? {} : { contextWindow },
      ...maxTokens === undefined ? {} : { maxTokens },
    })
  }
  return models
}

/**
 * Accept one probe key, or refuse it before the header is built. Without this
 * the `fetch` below would throw a ByteString `TypeError` that this function's
 * catch reports as `could not reach <url>` — blaming the network for a local,
 * deterministic fault.
 * @param raw - the key typed into the form or read from storage.
 * @returns the trimmed, usable key.
 */
function usableProbeKey(raw: string): string {
  const checked = normalizeApiKey(raw)
  if (checked.ok) return checked.value
  throw new LlmError(
    checked.reason === 'empty'
      ? 'this provider\'s API key is blank; enter it on the Models page, or clear it to probe unauthenticated'
      : 'this provider\'s API key contains characters no HTTP header can carry; paste the raw key only',
    INVALID_CREDENTIAL_CODE,
  )
}

/**
 * Issue one candidate's listing request and read its models. Every failure is
 * a coded `LlmError`: the caller either propagates it (an explicitly pinned
 * protocol) or folds it into an across-the-board verdict (autodetect).
 */
async function probe(
  candidate: ProbeCandidate,
  apiKey: string | undefined,
  signal: AbortSignal | undefined,
): Promise<LlmDiscoveredModel[]> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...attributionHeaders(),
  }
  if (apiKey !== undefined) {
    if (candidate.style === 'anthropic') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = ANTHROPIC_VERSION
    } else {
      headers.authorization = `Bearer ${apiKey}`
    }
  }
  let response: Response
  try {
    response = await fetch(candidate.url, {
      method: 'GET',
      headers,
      ...signal === undefined ? {} : { signal },
    })
  } catch (error: unknown) {
    if (signal?.aborted) {
      throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error })
    }
    throw new LlmError(`could not reach ${candidate.url}`, 'DISCOVERY_FAILED', { cause: error })
  }
  if (!response.ok) {
    throw new LlmError(
      `${candidate.url} answered ${response.status}${response.status === 401 || response.status === 403 ? '; check the API key' : ''}`,
      'DISCOVERY_FAILED',
      { status: response.status },
    )
  }
  let text: string
  try {
    text = await readBounded(response, candidate.url)
  } catch (error: unknown) {
    // Cancellation during the body read rejects with the abort reason, which
    // may be any value; the caller gets the same coded failure it would have
    // for a cancellation before the request went out.
    if (signal?.aborted) {
      throw new LlmError('model discovery aborted by caller', 'ABORTED', { cause: error })
    }
    throw error
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch (error: unknown) {
    throw new LlmError(`${candidate.url} did not answer with JSON`, 'DISCOVERY_FAILED', { cause: error })
  }
  return readListing(body)
}

/**
 * Interrogate one draft provider endpoint for the models it advertises.
 * @param request - the endpoint, protocol, and one-shot credential to use.
 * @param storedApiKey - the credential the named route already stored, asked
 *   for only when the draft carries none and only on the path that reaches the
 *   network. A configuration surface never holds a stored secret — it edits a
 *   redacted descriptor — so without this an already-configured route would be
 *   interrogated unauthenticated and answer 401.
 * @returns the advertised models in endpoint order, plus the protocol the
 *   endpoint was confirmed speaking when the draft left the protocol to
 *   detection. A catalog answer and an explicitly pinned protocol both leave
 *   `detectedApi` unset — neither adds information the caller did not have.
 * @throws LlmError with `DISCOVERY_UNAUTHORIZED` when every probed shape
 *   answered 401/403, `DISCOVERY_UNSUPPORTED` when the draft pinned a protocol
 *   this build cannot read, `DISCOVERY_FAILED` when no shape produced a
 *   listing, or `ABORTED` on caller cancellation.
 */
export async function discoverModels(
  request: LlmModelDiscoveryRequest,
  storedApiKey?: () => Promise<string | undefined>,
): Promise<LlmModelDiscoveryResult> {
  // A catalog route already has its answer, and a better one: the installed
  // entries carry context windows and output caps no listing endpoint reports.
  if (request.provider !== undefined) {
    const installed = catalogModels(request.provider)
    if (installed.size > 0) {
      return {
        models: [...installed.values()].map(model => ({
          id: model.id,
          name: model.name,
          contextWindow: model.contextWindow,
          maxTokens: model.maxTokens,
        })),
      }
    }
  }
  if (request.baseURL === undefined || request.baseURL.length === 0) {
    throw new LlmError(
      `pi-ai ships no catalog for provider "${request.provider ?? ''}", so its models can only come from its`
      + " endpoint; set a baseURL, or enter this provider's models by hand",
      'DISCOVERY_FAILED',
    )
  }
  if (request.api !== undefined && !LISTABLE_PROTOCOLS.has(request.api)) {
    throw new LlmError(
      `pi-ai protocol "${request.api}" has no model listing this build can read; enter this provider's models by hand`,
      'DISCOVERY_UNSUPPORTED',
    )
  }
  // A key typed into the form wins: it is the one the user is testing, and it
  // may be the replacement for exactly the stored key that is failing. The
  // stored one is only asked for here, past the catalog short-circuit and the
  // protocol check, so a route answered from the registry costs no credential
  // lookup — and no diagnostic about a credential it never needed.
  // A probe carrying no key stays unauthenticated, which is how a route that
  // relies on the provider's own ambient discovery is meant to be asked.
  const supplied = request.apiKey ?? await storedApiKey?.()
  const apiKey = supplied === undefined ? undefined : usableProbeKey(supplied)
  const candidates = probeCandidates(request.baseURL, request.api)
  if (candidates.length === 1) {
    // The draft pinned the protocol: one request, one honest answer. No
    // `detectedApi` — the caller already knows what it asked for.
    return { models: await probe(candidates[0]!, apiKey, request.signal) }
  }
  // Autodetect: first readable listing wins and names the protocol. An empty
  // listing still wins — the shape matched, and "this endpoint lists no
  // models" is the truthful answer for the protocol it confirmed.
  let sawRefusal = false
  let lastFailure: unknown
  for (const candidate of candidates) {
    try {
      const models = await probe(candidate, apiKey, request.signal)
      return { models, detectedApi: candidate.api }
    } catch (error: unknown) {
      if (error instanceof LlmError && error.failure.code === 'ABORTED') throw error
      if (error instanceof LlmError && (error.failure.status === 401 || error.failure.status === 403)) {
        sawRefusal = true
      }
      lastFailure = error
    }
  }
  if (sawRefusal) {
    throw new LlmError(
      `every model-listing shape at ${request.baseURL} answered 401/403; check the API key for this provider`,
      'DISCOVERY_UNAUTHORIZED',
      { cause: lastFailure instanceof Error ? lastFailure : undefined },
    )
  }
  throw new LlmError(
    `no model listing could be read from ${request.baseURL}; check the Base URL, or enter this provider's models by hand`,
    'DISCOVERY_FAILED',
    { cause: lastFailure instanceof Error ? lastFailure : undefined },
  )
}
