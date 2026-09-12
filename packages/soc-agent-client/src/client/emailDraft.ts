export const ZIMBRA_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_send_email'
export const ZIMBRA_FORWARD_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_forward_email'
export const ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_use_signature_on_email'

export interface EmailDraftFields {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  body_format?: 'text' | 'html'
  forward_message_id?: string
  forwarded_message?: {
    subject?: string
    from?: string
    date?: string
    body?: string
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

export function parseRecipientText(value: string): string[] {
  return [...new Set(value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean))]
}

export function draftFromForm(fields: EmailDraftFormFields, forwardMessageId?: string): EmailDraftFields {
  return {
    to: parseRecipientText(fields.to),
    cc: parseRecipientText(fields.cc),
    bcc: parseRecipientText(fields.bcc),
    subject: fields.subject.trim(),
    body: fields.body,
    ...(forwardMessageId === undefined ? {} : { forward_message_id: forwardMessageId }),
  }
}
