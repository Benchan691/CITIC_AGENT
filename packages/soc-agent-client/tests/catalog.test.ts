import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  CATALOG_DRAFT_TOOL_NAMES,
  CATALOG_FIELDS,
  catalogErrorMessage,
  catalogFieldErrors,
  catalogSubtitle,
  catalogTitle,
  formFromRecord,
  parseCatalogEnvelope,
  parseEnvelopeText,
  recordFromForm,
  validateCatalogForm,
  CATALOG_WRITE_RULE_TOOL_NAME,
  CATALOG_UPDATE_CUSTOMER_TOOL_NAME,
  catalogSavePayload,
  requireCatalogRecord,
} from '../src/client/catalog.ts'

const ROOT = join(import.meta.dirname, '..')

test('catalog edits preserve the selected ID and revision while creates have neither', () => {
  const fields = { customer_code: 'sample', display_name: 'Updated' }
  assert.deepEqual(catalogSavePayload('customer', fields, { record_id: 'customer-1', revision: 7 }), {
    catalog: 'customer', operation: 'update', record: recordFromForm('customer', fields),
    record_id: 'customer-1', expected_revision: 7,
  })
  const created = catalogSavePayload('customer', fields, null)
  assert.equal(created.operation, 'write')
  assert.equal('expected_revision' in created, false)
  assert.equal('record_id' in created, false)
  assert.throws(() => catalogSavePayload('customer', fields, { record_id: 'customer-1' }), /revision/)
  assert.throws(() => requireCatalogRecord(null), /record/)
})

function textBlock(payload: unknown): import('@deepseek-ai/dsh-client-runtime/client').ToolCallBlock {
  return {
    kind: 'tool',
    callId: 'call-1',
    toolName: CATALOG_WRITE_RULE_TOOL_NAME,
    isError: false,
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  } as never
}

test('catalog draft tool names follow the MCP wire convention', () => {
  assert.equal(CATALOG_WRITE_RULE_TOOL_NAME, 'mcp__soc_agent__catalog_write_rule')
  assert.equal(CATALOG_UPDATE_CUSTOMER_TOOL_NAME, 'mcp__soc_agent__catalog_update_customer')
  assert.equal(CATALOG_DRAFT_TOOL_NAMES.length, 6)
})

test('catalog field sets cover the editable columns per catalog', () => {
  assert.deepEqual([...CATALOG_FIELDS.customer], [
    'customer_code', 'display_name', 'tenant_number', 'gid', 'lifecycle_status', 'notes',
  ])
  assert.ok(CATALOG_FIELDS.rule.includes('rule_number'))
  assert.ok(CATALOG_FIELDS.rule.includes('rule_name_cn'))
  assert.ok(CATALOG_FIELDS.rule.includes('rule_name_zh'))
  assert.deepEqual([...CATALOG_FIELDS.fix_source_type], [
    'customer_id', 'system_name', 'fix_source_type_value', 'default_fix_index', 'description',
  ])
})

test('formFromRecord and recordFromForm round-trip rule fields', () => {
  const record = {
    catalog: 'rule',
    rule_number: '0001',
    rule_name_en: 'Threat Detection',
    severity: 'high',
    status: 'active',
  }
  const fields = formFromRecord(record)
  assert.equal(fields.rule_number, '0001')
  assert.equal(fields.severity, 'high')
  const recordOut = recordFromForm('rule', fields)
  assert.equal(recordOut.rule_number, '0001')
  assert.equal(recordOut.rule_name_en, 'Threat Detection')
})

test('validateCatalogForm reports the exact missing fields', () => {
  const errors = validateCatalogForm('customer', { customer_code: '', display_name: '' })
  assert.ok(errors.customer_code.includes('required'))
  assert.ok(errors.display_name.includes('required'))
  const ruleErrors = validateCatalogForm('rule', { rule_number: 'abc', rule_name_en: 'x' })
  assert.match(ruleErrors.rule_number ?? '', /1-4 digits/)
})

test('parseCatalogEnvelope unwraps the success envelope and errors', () => {
  const ok = parseCatalogEnvelope(textBlock({
    ok: true,
    data: {
      status: 'draft',
      catalog: 'rule',
      record: { catalog: 'rule', rule_number: '7412' },
      operation: 'write',
      expected_revision: null,
    },
  }))
  assert.equal(ok?.catalog, 'rule')
  assert.equal(ok?.record.rule_number, '7412')
  assert.equal(ok?.operation, 'write')

  const failed = parseCatalogEnvelope(textBlock({
    ok: false,
    error: { code: 'validation_failed', message: 'Ruleset validation failed.' },
  }))
  assert.equal(catalogErrorMessage(failed), 'Ruleset validation failed.')
})

test('parseCatalogEnvelope handles MCP transport error text', () => {
  const envelope = { ok: false, error: { code: 'validation_failed', message: 'Ruleset validation failed.' } }
  const parsed = parseCatalogEnvelope({
    kind: 'tool-result',
    content: [{ type: 'text', text: `Error executing tool catalog_write_rule: ${JSON.stringify(envelope)}` }],
    isError: true,
  } as never)
  assert.equal(catalogErrorMessage(parsed), 'Ruleset validation failed.')
  assert.equal(parseEnvelopeText('Error executing tool x: no json'), null)
})

test('catalogFieldErrors extracts per-field server messages', () => {
  const errors = catalogFieldErrors({
    details: { fields: { rule_number: 'use 1-4 digits', severity: 'choose one of: info' } },
  })
  assert.equal(errors.rule_number, 'use 1-4 digits')
  assert.equal(errors.severity, 'choose one of: info')
  assert.deepEqual(catalogFieldErrors(undefined), {})
})

test('catalog titles and subtitles render per catalog', () => {
  assert.equal(catalogTitle({ display_name: 'Fubon Securities', customer_code: 'fubon' }, 'customer'), 'Fubon Securities')
  assert.equal(catalogSubtitle({ customer_code: 'fubon' }, 'customer'), 'fubon')
  assert.equal(catalogTitle({ rule_name_en: 'Threat Detection' }, 'rule'), 'Threat Detection')
  assert.equal(catalogSubtitle({ rule_number: '7732' }, 'rule'), 'Rule 7732')
  assert.equal(catalogTitle({ system_name: 'QiAnXin EDR' }, 'fix_source_type'), 'QiAnXin EDR')
})

test('toolview registers every draft tool and saves through the authenticated RPC', () => {
  const source = readFileSync(join(ROOT, 'src/client/CatalogToolview.tsx'), 'utf8')
  for (const toolName of CATALOG_DRAFT_TOOL_NAMES) {
    assert.ok(source.includes(`'${toolName}'`) || CATALOG_DRAFT_TOOL_NAMES.includes(toolName as never))
  }
  assert.match(source, /save-catalog-record/)
  assert.match(source, /expected_revision/)
  assert.match(source, /data-dshcf-preserve="true"/)

  const manager = readFileSync(join(ROOT, 'src/client/CatalogManager.tsx'), 'utf8')
  for (const endpoint of ['catalog-list', 'catalog-get', 'catalog-history', 'save-catalog-record', 'archive-catalog-record', 'catalog-preview-publish', 'publish-catalog', 'rollback-publication']) {
    assert.ok(manager.includes(endpoint), `manager must call ${endpoint}`)
  }

  const index = readFileSync(join(ROOT, 'src/client/index.ts'), 'utf8')
  assert.match(index, /\/catalogs/)
  assert.match(index, /installCatalogToolview/)
})
