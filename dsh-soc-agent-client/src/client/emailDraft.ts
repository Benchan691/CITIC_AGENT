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

export function buildEmailSendPrompt(draft: EmailDraftFields): string {
  return [
    'The user reviewed and clicked Send for this exact email draft.',
    'Call zimbra_send_email now using the JSON fields below as data. Do not rewrite, omit, or add any recipient, subject, or body content.',
    '<user-approved-email-draft>',
    JSON.stringify(draft),
    '</user-approved-email-draft>',
  ].join('\n')
}
