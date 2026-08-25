import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {
  ComposerDocument, ComposerDocumentProvider, DraftAttachmentId, MarkdownAttachment,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId, SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import {
  DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, type MarkItDownAttachmentSettings,
} from '../attachment-constants.ts'

const CHANNEL = '/soc-agent-config'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

function settingsOf(scope: SettingsScope<MarkItDownAttachmentSettings>): MarkItDownAttachmentSettings {
  return { ...DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, ...(scope.getSnapshot().value ?? {}) }
}

export class MarkItDownDocumentController implements ComposerDocumentProvider {
  private readonly drafts = new Map<SessionId, Map<DraftAttachmentId, ComposerDocument>>()
  private readonly aborts = new Map<DraftAttachmentId, AbortController>()
  private readonly listeners = new Set<() => void>()
  private version = 0

  constructor(
    private readonly connection: ConnectionHandle,
    private readonly settings: SettingsScope<MarkItDownAttachmentSettings>,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  getVersion = (): number => this.version

  create(sessionId: SessionId, files: readonly File[]): readonly ComposerDocument[] {
    const limits = settingsOf(this.settings)
    const sessionDrafts = this.drafts.get(sessionId) ?? new Map<DraftAttachmentId, ComposerDocument>()
    if (files.length === 0) return []
    if (sessionDrafts.size + files.length > limits.maxFiles) throw new Error(`You can attach up to ${limits.maxFiles} files per message.`)
    const totalBytes = [...sessionDrafts.values()].reduce((total, item) => total + item.file.size, 0)
    if (files.some(file => file.size > limits.maxBytesPerFile)) throw new Error('One attachment exceeds the configured per-file size limit.')
    if (totalBytes + files.reduce((total, file) => total + file.size, 0) > limits.maxTotalBytes) throw new Error('The attachments exceed the configured total size limit.')
    const created = files.map(file => ({
      kind: 'document' as const,
      id: crypto.randomUUID() as DraftAttachmentId,
      file,
      status: 'queued' as const,
    }))
    for (const document of created) sessionDrafts.set(document.id, document)
    this.drafts.set(sessionId, sessionDrafts)
    this.changed()
    return created
  }

  list(sessionId: SessionId, ids: readonly DraftAttachmentId[]): readonly ComposerDocument[] {
    const drafts = this.drafts.get(sessionId)
    if (drafts === undefined) return []
    return ids.flatMap(id => {
      const document = drafts.get(id)
      return document === undefined ? [] : [document]
    })
  }

  release(sessionId: SessionId, id: DraftAttachmentId): void {
    this.aborts.get(id)?.abort()
    this.aborts.delete(id)
    const drafts = this.drafts.get(sessionId)
    if (drafts?.delete(id)) this.changed()
    if (drafts?.size === 0) this.drafts.delete(sessionId)
  }

  async convert(sessionId: SessionId, ids: readonly DraftAttachmentId[], signal: AbortSignal): Promise<readonly MarkdownAttachment[]> {
    const limits = settingsOf(this.settings)
    const result: MarkdownAttachment[] = []
    let totalChars = 0
    for (const id of ids) {
      if (signal.aborted) throw new Error('attachment_conversion_cancelled')
      const document = this.drafts.get(sessionId)?.get(id)
      if (document === undefined) continue
      this.setStatus(sessionId, id, 'converting')
      const localAbort = new AbortController()
      const abort = () => { localAbort.abort() }
      signal.addEventListener('abort', abort, { once: true })
      this.aborts.set(id, localAbort)
      try {
        const bytes = new Uint8Array(await document.file.arrayBuffer())
        const response = await this.connection.rpc.call(CHANNEL, 'convert-attachment', {
          filename: document.file.name,
          content_type: document.file.type,
          data: bytesToBase64(bytes),
          limits: { max_bytes: limits.maxBytesPerFile, max_chars: limits.maxCharsPerFile },
        }, localAbort.signal)
        if (!response?.ok) throw new Error(response?.error?.message || 'The attachment conversion failed.')
        const converted = response.value as { text?: unknown; filename?: unknown }
        const markdown = typeof converted.text === 'string' ? converted.text : ''
        totalChars += markdown.length
        if (totalChars > limits.maxTotalChars) throw new Error('The attachments exceed the configured Markdown character limit.')
        if (!this.drafts.get(sessionId)?.has(id)) continue
        this.setStatus(sessionId, id, 'converted')
        result.push({ id, filename: typeof converted.filename === 'string' ? converted.filename : document.file.name, markdown })
      } catch (error: unknown) {
        if (localAbort.signal.aborted || signal.aborted) {
          if (!this.drafts.get(sessionId)?.has(id)) continue
          throw new Error('attachment_conversion_cancelled')
        }
        const message = error instanceof Error ? error.message : 'The attachment conversion failed.'
        this.setStatus(sessionId, id, 'failed', message)
        throw new Error(message)
      } finally {
        signal.removeEventListener('abort', abort)
        if (this.aborts.get(id) === localAbort) this.aborts.delete(id)
      }
    }
    return result
  }

  private setStatus(sessionId: SessionId, id: DraftAttachmentId, status: ComposerDocument['status'], error?: string): void {
    const drafts = this.drafts.get(sessionId)
    const current = drafts?.get(id)
    if (current === undefined) return
    drafts?.set(id, { ...current, status, ...(error === undefined ? {} : { error }) })
    this.changed()
  }

  private changed(): void {
    this.version += 1
    for (const listener of this.listeners) listener()
  }
}
