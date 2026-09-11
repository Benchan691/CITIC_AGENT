import assert from 'node:assert/strict'
import test from 'node:test'
import {
  draftFromForm,
  parseRecipientText,
  type EmailDraftFormFields,
} from '../src/client/emailDraft.ts'

const form: EmailDraftFormFields = {
  to: 'to@example.com, second@example.com\nto@example.com',
  cc: 'cc@example.com; ',
  bcc: '',
  subject: '  An exact subject  ',
  body: 'The exact body.',
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
  })
})
