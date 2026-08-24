import assert from 'node:assert/strict'
import test from 'node:test'
import {
  draftFromForm,
  parseRecipientText,
  sendEmailDraft,
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

test('direct sender reports success without creating a send prompt', async () => {
  const draft = draftFromForm(form)
  const calls: unknown[] = []
  const statuses: string[] = []
  await sendEmailDraft(
    async value => { calls.push(value); return { sent: true } },
    async status => { statuses.push(status) },
    draft,
  )
  assert.deepEqual(calls, [draft])
  assert.deepEqual(statuses, ['success'])
})

test('direct sender reports failure and rethrows the API error', async () => {
  const statuses: string[] = []
  await assert.rejects(
    sendEmailDraft(
      async () => { throw new Error('blocked') },
      async status => { statuses.push(status) },
      draftFromForm(form),
    ),
    /blocked/,
  )
  assert.deepEqual(statuses, ['failed'])
})

test('status notification failure does not turn a sent email into a failure', async () => {
  await sendEmailDraft(
    async () => ({ sent: true }),
    async () => { throw new Error('session closed') },
    draftFromForm(form),
  )
})

test('uses the host-qualified wire tool name for keyed rendering', () => {
  assert.equal(ZIMBRA_DRAFT_TOOL_NAME, 'mcp__soc_agent__zimbra_create_email_draft')
})
