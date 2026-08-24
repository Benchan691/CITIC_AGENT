import assert from 'node:assert/strict'
import test from 'node:test'
import {
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

test('uses the host-qualified wire tool name for keyed rendering', () => {
  assert.equal(ZIMBRA_DRAFT_TOOL_NAME, 'mcp__soc_agent__zimbra_send_email')
})
