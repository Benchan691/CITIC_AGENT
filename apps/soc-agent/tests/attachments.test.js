import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareAttachmentRequest } from '../host.js'

const payload = {
  filename: 'events.csv', content_type: 'text/csv',
  data: Buffer.from('id,value\n1,2\n').toString('base64'),
  investigation_id: 'own-chat', session_id: 'forged-session', user_id: 'other-user',
}
function context(owner = { userId: 'user-a' }) {
  return { get: () => ({
    requireSession: () => ({ id: 'real-session', userId: 'user-a' }),
    store: { sessionOwner: async id => id === 'own-chat' ? owner : undefined },
  }) }
}

test('attachment processing uses the authenticated identity and owned chat', async () => {
  const request = await prepareAttachmentRequest(context(), payload)
  assert.equal(request.session_id, 'real-session')
  assert.equal(request.investigation_id, 'own-chat')
  assert.equal(request.data, payload.data)
  assert.equal('user_id' in request, false)
})

test('attachments reject foreign, missing and unauthenticated chats', async () => {
  await assert.rejects(prepareAttachmentRequest(context({ userId: 'user-b' }), payload), /unavailable/)
  await assert.rejects(prepareAttachmentRequest(context(), { ...payload, investigation_id: 'missing' }), /unavailable/)
  await assert.rejects(prepareAttachmentRequest(context(), { ...payload, investigation_id: '' }), /Choose a chat/)
  await assert.rejects(prepareAttachmentRequest({ get: () => undefined }, payload), /authentication required/)
})
