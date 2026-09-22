export const ZIMBRA_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_send_email'
export const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_use_signature_on_email'

export const EMAIL_ATTACHMENT_LIMITS = {
  maxFiles: 5,
  maxBytesPerFile: 10_000_000,
  maxTotalBytes: 50_000_000,
} as const

export interface EmailAttachmentPayload {
  filename: string
  content_type: string
  data: string
}

export type EmailDraftAction = 'send' | 'reply' | 'forward'

export interface EmailDraftFields {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  action?: EmailDraftAction
  body_format?: 'html'
  source_message_id?: string
  reply_all?: boolean
  source_message?: {
    subject?: string
    from?: string
    to?: string[]
    cc?: string[]
    date?: string
    body?: string
    body_type?: string
    body_truncated?: boolean
    attachments?: { filename: string; part: string }[]
  }
}

export interface EmailDraftFormFields {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
}

export interface EmailDraftMetadata {
  action?: EmailDraftAction
  body_format?: 'html'
  source_message_id?: string
  reply_all?: boolean
}

function invalidFilename(filename: string): boolean {
  return !filename || filename.length > 255 || /[\u0000\r\n\\/]/u.test(filename)
}

export function validateEmailAttachmentSelection(
  files: readonly File[],
  existing: readonly File[] = [],
): string | null {
  if (existing.length + files.length > EMAIL_ATTACHMENT_LIMITS.maxFiles) {
    return `Select no more than ${EMAIL_ATTACHMENT_LIMITS.maxFiles} files.`
  }
  let totalBytes = existing.reduce((sum, file) => sum + file.size, 0)
  for (const file of files) {
    if (invalidFilename(file.name)) return `The filename "${file.name}" is not allowed.`
    if (file.size > EMAIL_ATTACHMENT_LIMITS.maxBytesPerFile) {
      return `${file.name} exceeds the 10 MB per-file limit.`
    }
    totalBytes += file.size
  }
  if (totalBytes > EMAIL_ATTACHMENT_LIMITS.maxTotalBytes) {
    return 'The selected files exceed the 50 MB total limit.'
  }
  return null
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof globalThis.btoa !== 'function') throw new Error('Base64 encoding is unavailable in this browser.')
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)))
  }
  return globalThis.btoa(binary)
}

export async function fileToEmailAttachment(file: File): Promise<EmailAttachmentPayload> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return {
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    data: bytesToBase64(bytes),
  }
}

export function parseRecipientText(value: string): string[] {
  return [...new Set(value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean))]
}

export function draftFromForm(fields: EmailDraftFormFields, metadata: EmailDraftMetadata = {}): EmailDraftFields {
  return {
    to: parseRecipientText(fields.to),
    cc: parseRecipientText(fields.cc),
    bcc: parseRecipientText(fields.bcc),
    subject: fields.subject.trim(),
    body: fields.body,
    ...metadata,
  }
}
