export const ZIMBRA_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_send_email'
export const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_use_signature_on_email'

export type EmailDraftAction = 'send' | 'reply' | 'forward'

export interface EmailDraftFields {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  action?: EmailDraftAction
  body_format?: 'text' | 'html'
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
  source_message_id?: string
  reply_all?: boolean
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
