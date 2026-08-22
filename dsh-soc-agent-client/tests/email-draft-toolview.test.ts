import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEmailSendPrompt,
  draftFromForm,
  parseRecipientText,
  ZIMBRA_DRAFT_TOOL_NAME,
  type EmailDraftFormFields,
} from '../src/client/emailDraft.ts'

const form: EmailDraftFormFields = {
  to: 'to@example.com, second@example.com\nto@example.com',
  cc: 'cc@example.com; ',
  bcc: '',
  subject: '  An exact subject  ',
  body: 'The exact body.',
  accountId: 'primary',
  accountLabel: 'Primary account',
}

test('normalizes editable recipient fields without duplicating addresses', () => {
  assert.deepEqual(parseRecipientText(' a@example.com, b@example.com\na@example.com; '), [
    'a@example.com',
    'b@example.com',
  ])
  assert.deepEqual(draftFromForm(form), {
    to: ['to@example.com', 'second@example.com'],
    cc: ['cc@example.com'],
    bcc: [],
    subject: 'An exact subject',
    body: 'The exact body.',
    account_id: 'primary',
  })
})

test('send prompt contains the exact finalized structured draft', () => {
  const draft = draftFromForm(form)
  const prompt = buildEmailSendPrompt(draft)
  assert.match(prompt, /Call zimbra_send_email now/)
  assert.match(prompt, /Do not rewrite, omit, or add any recipient, subject, or body content/)
  assert.ok(prompt.includes(`<user-approved-email-draft>\n${JSON.stringify(draft)}\n</user-approved-email-draft>`))
})

test('uses the host-qualified wire tool name for keyed rendering', () => {
  assert.equal(ZIMBRA_DRAFT_TOOL_NAME, 'mcp__soc_agent__zimbra_create_email_draft')
})
