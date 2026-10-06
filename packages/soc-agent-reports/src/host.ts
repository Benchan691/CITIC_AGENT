import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, isAbsolute } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ARTIFACT_ID, REPORT_DOWNLOAD_PREFIX, SESSION_ID, validArtifactType } from './report-contract.ts'

export interface ReportAuth { requireSession(): { id: string; userId: string } }
export type ReportCommand = (command: string, payload: Record<string, unknown>) => Promise<unknown>
type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }

function failure(error: unknown) {
  const candidate = record(error) ? error : undefined
  const message = error instanceof Error ? error.message : 'The report operation failed.'
  const code = typeof candidate?.code === 'string' ? candidate.code : message === 'authentication required' ? 'authentication_required' : 'report_operation_failed'
  return { ok: false as const, error: { code, message, details: {} } }
}

/** The signed-in app session is always supplied by the host, never the browser. */
export async function reportSettingsEndpoint(auth: ReportAuth, command: ReportCommand, endpoint: string, payload: unknown) {
  try {
    const session = auth.requireSession()
    if (!session.id) throw new Error('authentication required')
    if (endpoint === 'get-customer-settings') return { ok: true as const, value: await command('report-settings-get', { session_id: session.id }) }
    if (endpoint === 'save-customer-settings') {
      if (!record(payload) || !Array.isArray(payload.customers)) throw new Error('Enter a customer configuration list before saving.')
      return { ok: true as const, value: await command('report-settings-save', { session_id: session.id, customers: payload.customers }) }
    }
    throw new Error('Unknown report settings operation.')
  } catch (error) { return failure(error) }
}

export interface StoredReportArtifact { id: string; filename: string; mime_type: string; size_bytes: number; path: string; session_id: string }

export function validateStoredArtifact(value: unknown, id: string, sessionId: string): StoredReportArtifact {
  if (!record(value) || value.id !== id || value.session_id !== sessionId || !validArtifactType(value.filename, value.mime_type)
    || typeof value.path !== 'string' || !isAbsolute(value.path) || basename(value.path) !== value.filename
    || !Number.isSafeInteger(value.size_bytes) || (value.size_bytes as number) <= 0) {
    throw new Error('The report artifact metadata is invalid.')
  }
  return value as unknown as StoredReportArtifact
}

function disposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/gu, '_').replace(/["\\]/gu, '_')
  const utf8 = encodeURIComponent(filename).replace(/['()*]/gu, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
}

/** Lookup authorizes user + conversation ownership before the host reads bytes. */
export async function downloadReportArtifact(request: IncomingMessage, response: ServerResponse, auth: ReportAuth, command: ReportCommand): Promise<void> {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    const session = auth.requireSession()
    if (!session.id) throw new Error('authentication required')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' })
      response.end()
      return
    }
    const url = new URL(request.url ?? '', 'http://dsh.internal')
    const id = url.pathname.slice(REPORT_DOWNLOAD_PREFIX.length)
    const investigationId = url.searchParams.get('session_id')
    if (!url.pathname.startsWith(REPORT_DOWNLOAD_PREFIX) || !ARTIFACT_ID.test(id) || investigationId === null || !SESSION_ID.test(investigationId)
      || [...url.searchParams.keys()].length !== 1) {
      response.writeHead(404, { 'cache-control': 'no-store' })
      response.end('Report file not found.')
      return
    }
    const artifact = validateStoredArtifact(await command('report-artifact-get', {
      session_id: session.id, artifact_id: id, investigation_id: investigationId,
    }), id, investigationId)
    // The backend selects this absolute path from its private registry. Refuse
    // symlinks and changed sizes before committing any successful HTTP headers.
    handle = await open(artifact.path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size !== artifact.size_bytes) throw new Error('The report artifact is missing or has changed.')
    response.writeHead(200, {
      'content-type': artifact.mime_type,
      'content-disposition': disposition(artifact.filename),
      'content-length': stat.size,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') response.end()
    else await pipeline(handle.createReadStream({ autoClose: false }), response)
  } catch (error) {
    if (response.headersSent) response.destroy(error instanceof Error ? error : undefined)
    else {
      const denied = error instanceof Error && error.message === 'authentication required'
      response.writeHead(denied ? 401 : 404, { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      response.end(denied ? 'Sign in to download this report.' : 'Report file not found or no longer available.')
    }
  } finally { await handle?.close() }
}
