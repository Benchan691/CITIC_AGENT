export const ZIMBRA_DRAFT_TOOL_NAME = 'mcp__soc_agent__zimbra_create_email_draft'

export interface EmailDraftFields {
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  body: string
  account_id: string
}

export interface EmailDraftFormFields {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  accountId: string
  accountLabel: string
}

export function parseRecipientText(value: string): string[] {
  return [...new Set(value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean))]
}

export function draftFromForm(fields: EmailDraftFormFields): EmailDraftFields {
  return {
    to: parseRecipientText(fields.to),
    cc: parseRecipientText(fields.cc),
    bcc: parseRecipientText(fields.bcc),
    subject: fields.subject.trim(),
    body: fields.body,
    account_id: fields.accountId,
  }
}

export type EmailSendStatus = 'success' | 'failed'

export async function sendEmailDraft(
  send: (draft: EmailDraftFields) => Promise<{ sent?: unknown }>,
  notify: (status: EmailSendStatus) => Promise<void>,
  draft: EmailDraftFields,
): Promise<void> {
  try {
    const result = await send(draft)
    if (result.sent !== true) throw new Error('Email send did not confirm success.')
    try { await notify('success') } catch { /* status reporting is best effort */ }
  } catch (error) {
    try { await notify('failed') } catch { /* status reporting is best effort */ }
    throw error
  }
}
