import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { toolDefinitions } from '../lib/index.js'
import {
  MemoryStore,
  detectSecrets,
  isActiveEntry,
  requestEmbeddings,
  socScopedStoreDir,
} from '../lib/store.js'
import {
  assertModelCannotSelectTenant,
  createMemoryContextRegistry,
  scopeKeyForTenant,
} from '../lib/tenant.js'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'citic-soc-memory-'))
  const globalStore = new MemoryStore(root)
  const stores = new Map([['global', globalStore]])
  const tenantContext = createMemoryContextRegistry({})
  const getStore = (key) => {
    let store = stores.get(key)
    if (store === undefined) {
      store = new MemoryStore(socScopedStoreDir(root, key))
      stores.set(key, store)
    }
    return store
  }
  const routeScope = async (args, exec) => {
    assertModelCannotSelectTenant(args)
    const scope = args?.scope ?? 'customer'
    const tenant = tenantContext.get(exec?.agent)
    const key = scope === 'global' ? 'global' : scopeKeyForTenant(scope, tenant)
    const store = getStore(key)
    return { key, kind: scope, tenant, store, runtime: { key, store } }
  }
  const ensureRuntime = async (runtime) => {
    await runtime.store.ensure()
    await runtime.store.seedSummary('', runtime.key === 'global' ? 8000 : 2400)
  }
  const resolved = {
    readOnlyScopes: [],
    rolloutPhase: 'manual',
    provenanceRequired: true,
    redactSecrets: true,
    maxBytes: 8000,
    scopeMaxBytes: 2400,
    embeddingBaseURL: '',
    embeddingModel: '',
    embeddingApiKey: '',
  }
  const definitions = toolDefinitions(globalStore, resolved, () => {}, {}, { state: {} }, routeScope, ensureRuntime, new Map())
  const tools = Object.fromEntries(definitions.map((definition) => [definition.name, definition]))
  const agentA = { session: { id: 'session-a' } }
  const agentB = { session: { id: 'session-b' } }
  tenantContext.set(agentA, { customerId: 'G50176', analystId: 'analyst-a' })
  tenantContext.set(agentB, { customerId: 'G47193', analystId: 'analyst-b' })
  const exec = (agent) => ({ agent, signal: new AbortController().signal })
  return { root, stores, tenantContext, tools, agentA, agentB, exec }
}

test('tenant scopes are host-resolved and reject model-selected identifiers', () => {
  assert.equal(scopeKeyForTenant('customer', { customerId: 'G50176' }), 'customer/G50176')
  assert.equal(scopeKeyForTenant('incident', { customerId: 'G50176', incidentId: 'INC-1' }), 'incident/G50176/INC-1')
  assert.throws(() => scopeKeyForTenant('customer', {}), /host/)
  assert.throws(() => assertModelCannotSelectTenant({ customer_id: 'G47193' }), /host-resolved/)
  assert.throws(() => assertModelCannotSelectTenant({ scope: 'customer/G47193' }), /host-resolved/)
  assert.throws(() => socScopedStoreDir('/tmp/memory', 'customer/../G47193'), /invalid SOC scope/)
})

test('store security primitives detect secrets, stale entries, and restrictive permissions', async () => {
  assert.ok(detectSecrets('authorization: Bearer abcdefghijklmnop'))
  assert.equal(isActiveEntry({ verification: 'stale' }), false)
  assert.equal(isActiveEntry({ verification: 'superseded' }), false)
  const root = mkdtempSync(join(tmpdir(), 'citic-soc-store-'))
  try {
    const store = new MemoryStore(root)
    await store.ensure()
    const entry = await store.appendRawEntry({ content: 'A small typed fact.', scope: 'global', type: 'soc_procedure' })
    assert.equal(statSync(root).mode & 0o777, 0o700)
    assert.equal(statSync(join(root, 'raw_memories.md')).mode & 0o777, 0o600)
    assert.equal(entry.content, 'A small typed fact.')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('remote embeddings require HTTPS and redact secret-like memory content', async () => {
  const originalFetch = globalThis.fetch
  let captured
  globalThis.fetch = async (_url, init) => {
    captured = JSON.parse(init.body)
    return {
      ok: true,
      async json() {
        return { data: captured.input.map((_, index) => ({ index, embedding: [index + 1] })) }
      },
    }
  }
  try {
    await assert.rejects(
      requestEmbeddings(['password: embedding-secret-value'], { baseURL: 'http://embedding.example.test' }),
      /must use HTTPS/,
    )
    await requestEmbeddings(
      ['password: embedding-secret-value'],
      { baseURL: 'http://embedding.example.test', allowInsecureHttp: true },
    )
    assert.equal(JSON.stringify(captured).includes('embedding-secret-value'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('summary history can roll back as a new version outside the model tool surface', async () => {
  const root = mkdtempSync(join(tmpdir(), 'citic-soc-history-'))
  try {
    const store = new MemoryStore(root)
    await store.ensure()
    await store.writeSeedSummary('## Stable procedure\n\nUse the approved escalation path.', 8000, 1)
    await store.archiveCurrentSummary()
    await store.writeSeedSummary('## Temporary procedure\n\nUse a temporary path.', 8000, 2)
    const rollback = await store.rollbackSummary(1, { maxBytes: 8000 })
    assert.equal(rollback.previousVersion, 2)
    assert.equal(rollback.restoredVersion, 3)
    assert.match(await store.readSummary(), /Use the approved escalation path/)
    assert.equal((await store.listSummaryHistory()).some((item) => item.version === 2), true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('SOC tools enforce tenant isolation, provenance, deduplication, supersession, expiry, and audit', async () => {
  const f = fixture()
  try {
    assert.deepEqual(Object.keys(f.tools).sort(), [
      'soc_memory_add',
      'soc_memory_correct',
      'soc_memory_forget',
      'soc_memory_read',
      'soc_memory_search',
    ])
    const add = await f.tools.soc_memory_add.execute({
      scope: 'customer',
      type: 'customer_environment',
      sourceType: 'splunk_investigation',
      sourceRef: 'search-123',
      content: 'Customer G50176 uses the customer_security index.',
      verification: 'verified',
    }, f.exec(f.agentA))
    assert.equal(add.duplicate, false)
    assert.equal(add.scope, 'customer/G50176')

    const ownSearch = await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'customer_security' }, f.exec(f.agentA))
    assert.equal(ownSearch.matches.length, 1)
    assert.equal(ownSearch.matches[0].verification, 'verified')
    assert.equal(ownSearch.matches[0].sourceType, 'splunk_investigation')

    const crossSearch = await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'customer_security' }, f.exec(f.agentB))
    assert.deepEqual(crossSearch.matches, [])
    await assert.rejects(
      f.tools.soc_memory_correct.execute({ scope: 'customer', id: add.id, correctedContent: 'Cross-tenant overwrite.', type: 'customer_environment', sourceType: 'analyst_confirmation' }, f.exec(f.agentB)),
      /resolved scope/,
    )
    await assert.rejects(
      f.tools.soc_memory_forget.execute({ scope: 'customer', id: add.id }, f.exec(f.agentB)),
      /resolved scope/,
    )

    const duplicate = await f.tools.soc_memory_add.execute({
      scope: 'customer',
      type: 'customer_environment',
      sourceType: 'analyst_confirmation',
      content: '  Customer G50176 uses the customer_security index.  ',
    }, f.exec(f.agentA))
    assert.equal(duplicate.duplicate, true)
    assert.equal(duplicate.reinforced, true)

    const correction = await f.tools.soc_memory_correct.execute({
      scope: 'customer',
      id: add.id,
      correctedContent: 'Customer G50176 uses the main index.',
      type: 'customer_environment',
      sourceType: 'analyst_confirmation',
      verification: 'verified',
    }, f.exec(f.agentA))
    assert.equal(correction.superseded, true)
    assert.ok(correction.newId)
    assert.equal((await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'customer_security' }, f.exec(f.agentA))).matches.length, 0)
    assert.equal((await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'main index' }, f.exec(f.agentA))).matches.length, 1)

    await assert.rejects(
      f.tools.soc_memory_add.execute({ scope: 'customer', type: 'customer_environment', sourceType: 'customer_report', content: 'password: correct-horse-battery-staple' }, f.exec(f.agentA)),
      /prohibited secret-like/,
    )
    await assert.rejects(
      f.tools.soc_memory_add.execute({ scope: 'customer', type: 'customer_environment', sourceType: 'not-a-source', content: 'A valid fact.' }, f.exec(f.agentA)),
      /sourceType/,
    )
    await assert.rejects(
      f.tools.soc_memory_add.execute({ scope: 'customer', type: 'customer_environment', sourceType: 'customer_report', content: 'x'.repeat(2001) }, f.exec(f.agentA)),
      /exceeds/,
    )
    await assert.rejects(
      f.tools.soc_memory_add.execute({ scope: 'customer/G47193', type: 'customer_environment', sourceType: 'customer_report', content: 'A valid fact.' }, f.exec(f.agentA)),
      /host-resolved/,
    )

    const expired = await f.tools.soc_memory_add.execute({
      scope: 'customer',
      type: 'false_positive_pattern',
      sourceType: 'customer_report',
      expiresAt: '2020-01-01T00:00:00Z',
      content: 'Temporary scanner noise is expired.',
    }, f.exec(f.agentA))
    assert.equal((await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'expired scanner noise' }, f.exec(f.agentA))).matches.length, 0)

    const global = await f.tools.soc_memory_add.execute({
      scope: 'global',
      type: 'soc_procedure',
      sourceType: 'system_configuration',
      content: 'Use the approved SOC escalation procedure.',
      verification: 'verified',
    }, f.exec(f.agentA))
    const globalSearch = await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'SOC escalation' }, f.exec(f.agentB))
    assert.equal(globalSearch.matches.some((match) => match.id === global.id && match.scope === 'global'), true)
    const typedGlobalSearch = await f.tools.soc_memory_search.execute({ scope: 'customer', query: 'SOC escalation', type: 'soc_procedure' }, f.exec(f.agentB))
    assert.equal(typedGlobalSearch.matches.some((match) => match.id === global.id && match.scope === 'global'), true)

    const forgotten = await f.tools.soc_memory_forget.execute({ scope: 'customer', id: expired.id, reason: 'temporary knowledge expired' }, f.exec(f.agentA))
    assert.equal(forgotten.forgotten, true)
    const read = await f.tools.soc_memory_read.execute({ scope: 'customer' }, f.exec(f.agentA))
    assert.equal(read.scope, 'customer/G50176')
    assert.equal(read.rawCount, 1)

    const restartedStore = new MemoryStore(join(f.root, 'customer', 'G50176'))
    await restartedStore.ensure()
    const reloaded = await restartedStore.searchRaw('main index', { includeArchive: true })
    assert.equal(reloaded.length, 1)
    assert.equal(reloaded[0].entry.sourceSessionId, 'session-a')

    const auditPath = join(f.root, 'customer', 'G50176', 'audit.jsonl')
    const audit = readFileSync(auditPath, 'utf8').trim().split('\n').map((line) => JSON.parse(line))
    assert.ok(audit.some((event) => event.operation === 'add'))
    assert.ok(audit.some((event) => event.operation === 'reinforce'))
    assert.ok(audit.some((event) => event.operation === 'correct'))
    assert.ok(audit.some((event) => event.operation === 'forget'))
    assert.ok(audit.every((event) => !Object.hasOwn(event, 'content')))
  } finally {
    rmSync(f.root, { recursive: true, force: true })
  }
})
