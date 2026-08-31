import assert from 'node:assert/strict'
import test from 'node:test'
import { Config } from '../lib/index.js'
import { memorySettingsRouteHandler, memorySettingsSnapshot } from '../lib/web.js'

function nodeRequest(method, body = '') {
  return {
    method,
    headers: method === 'POST'
      ? {
          'content-type': 'application/json',
          origin: 'http://localhost',
          host: 'localhost',
        }
      : {},
    async *[Symbol.asyncIterator]() {
      if (body !== '') yield Buffer.from(body)
    },
  }
}

function nodeResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    writeHead(status) {
      this.statusCode = status
    },
    end(body = '') {
      this.body = String(body)
    },
  }
}

function settingsFixture(initialEmbeddingApiKey = 'embedding-secret') {
  let revision = 7
  let user = { embeddingApiKey: initialEmbeddingApiKey, autoCapture: false }
  let value = { embeddingApiKey: initialEmbeddingApiKey, autoCapture: false }
  const replaced = []
  const settings = {
    writable: true,
    describe(options = {}) {
      if (options.redactSecrets === true) {
        return [{
          ns: 'memory',
          value: { autoCapture: value.autoCapture },
          base: {},
          user: { autoCapture: user.autoCapture },
          secrets: [{ path: ['embeddingApiKey'], set: value.embeddingApiKey !== undefined }],
          revision,
        }]
      }
      return [{ ns: 'memory', value: { ...value }, user: { ...user }, revision }]
    },
    async replace(ns, next, expectedRevision) {
      assert.equal(ns, 'memory')
      assert.equal(expectedRevision, revision)
      replaced.push({ ...next })
      value = { ...next }
      user = { ...next }
      revision += 1
    },
  }
  return { settings, replaced }
}

test('memory settings schema marks the embedding API key as secret', () => {
  assert.equal(Config.dict.embeddingApiKey.meta.role, 'secret')
})

test('memory settings snapshots redact the embedding API key', () => {
  const { settings } = settingsFixture()
  const snapshot = memorySettingsSnapshot(settings)
  assert.equal(JSON.stringify(snapshot).includes('embedding-secret'), false)
  assert.deepEqual(snapshot.settings.value, { autoCapture: false })
  assert.deepEqual(snapshot.settings.user, { autoCapture: false })
  assert.deepEqual(snapshot.settings.secrets, [{ path: ['embeddingApiKey'], set: true }])
})

test('memory settings report an empty embedding key as not configured', () => {
  const { settings } = settingsFixture('')
  const snapshot = memorySettingsSnapshot(settings)
  assert.deepEqual(snapshot.settings.secrets, [{ path: ['embeddingApiKey'], set: false }])
  assert.equal(JSON.stringify(snapshot).includes('embedding-secret'), false)
})

test('memory settings save preserves omitted secrets and supports explicit set and clear', async () => {
  const fixture = settingsFixture()
  const handler = memorySettingsRouteHandler({ logger: { warn() {} } }, fixture.settings)

  const preserveResponse = nodeResponse()
  await handler(nodeRequest('POST', JSON.stringify({
    action: 'save',
    expectedRevision: 7,
    value: { autoCapture: true },
  })), preserveResponse)
  assert.equal(preserveResponse.statusCode, 200)
  assert.deepEqual(fixture.replaced[0], { autoCapture: true, embeddingApiKey: 'embedding-secret' })
  assert.equal(preserveResponse.body.includes('embedding-secret'), false)

  const setResponse = nodeResponse()
  await handler(nodeRequest('POST', JSON.stringify({
    action: 'save',
    expectedRevision: 8,
    value: { autoCapture: false, embeddingApiKey: 'new-secret' },
  })), setResponse)
  assert.equal(setResponse.statusCode, 200)
  assert.deepEqual(fixture.replaced[1], { autoCapture: false, embeddingApiKey: 'new-secret' })
  assert.equal(setResponse.body.includes('new-secret'), false)

  const clearResponse = nodeResponse()
  await handler(nodeRequest('POST', JSON.stringify({
    action: 'save',
    expectedRevision: 9,
    value: { autoCapture: true, embeddingApiKey: '' },
  })), clearResponse)
  assert.equal(clearResponse.statusCode, 200)
  assert.deepEqual(fixture.replaced[2], { autoCapture: true, embeddingApiKey: '' })
  assert.deepEqual(JSON.parse(clearResponse.body).value.settings.secrets, [{ path: ['embeddingApiKey'], set: false }])
})

test('memory settings save rejects cross-origin POSTs before persistence', async () => {
  const fixture = settingsFixture()
  const handler = memorySettingsRouteHandler({ logger: { warn() {} } }, fixture.settings)
  const request = nodeRequest('POST', JSON.stringify({
    action: 'save',
    expectedRevision: 7,
    value: { autoCapture: true },
  }))
  request.headers.origin = 'https://attacker.example'
  const response = nodeResponse()

  await handler(request, response)

  assert.equal(response.statusCode, 403)
  assert.deepEqual(fixture.replaced, [])
})
