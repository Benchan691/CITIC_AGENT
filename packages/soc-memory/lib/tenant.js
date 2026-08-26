// Tenant and scope primitives for the CITIC SOC memory fork.
//
// Scope identifiers are deliberately resolved outside the model-facing tool
// arguments. The host binds this context from trusted deployment state; the
// memory tools accept only a scope kind such as "customer" or "incident".

export const MEMORY_SCOPE_TYPES = Object.freeze(['global', 'analyst', 'customer', 'incident'])
export const MEMORY_TYPES = Object.freeze([
  'customer_environment',
  'false_positive_pattern',
  'detection_knowledge',
  'investigation_lesson',
  'customer_procedure',
  'splunk_context',
  'asset_context',
  'soc_procedure',
  'analyst_preference',
])
export const MEMORY_STATES = Object.freeze(['verified', 'unverified', 'stale', 'superseded'])
export const MEMORY_SOURCE_TYPES = Object.freeze([
  'splunk_investigation',
  'zimbra_email',
  'customer_report',
  'analyst_confirmation',
  'user_confirmed',
  'memory_review',
  'automatic_extraction',
  'system_configuration',
])

const MEMORY_TYPES_BY_SCOPE = Object.freeze({
  global: new Set(['detection_knowledge', 'soc_procedure']),
  analyst: new Set(['analyst_preference', 'detection_knowledge', 'investigation_lesson']),
  customer: new Set([
    'customer_environment',
    'false_positive_pattern',
    'detection_knowledge',
    'investigation_lesson',
    'customer_procedure',
    'splunk_context',
    'asset_context',
  ]),
  incident: new Set([
    'false_positive_pattern',
    'detection_knowledge',
    'investigation_lesson',
    'customer_procedure',
    'splunk_context',
    'asset_context',
  ]),
})

export function isMemoryTypeAllowed(scope, type) {
  return MEMORY_TYPES_BY_SCOPE[normalizeMemoryScopeType(scope)]?.has(String(type ?? '').trim().toLowerCase()) === true
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const MODEL_TENANT_FIELDS = Object.freeze([
  'customer_id',
  'customerId',
  'tenant_id',
  'tenantId',
  'analyst_id',
  'analystId',
  'incident_id',
  'incidentId',
  'scope_key',
  'scopeKey',
  'namespace',
])

export function validateIdentifier(value, field = 'identifier') {
  const normalized = String(value ?? '').trim()
  if (!ID_PATTERN.test(normalized) || normalized === '.' || normalized === '..') {
    throw new Error(`memory: invalid ${field}`)
  }
  return normalized
}

export function normalizeMemoryScopeType(value, fallback = 'customer') {
  const normalized = String(value ?? fallback).trim().toLowerCase()
  if (!MEMORY_SCOPE_TYPES.includes(normalized)) {
    throw new Error(`memory: scope must be one of ${MEMORY_SCOPE_TYPES.join(', ')}`)
  }
  return normalized
}

export function normalizeTenantContext(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('memory: resolved tenant context must be an object')
  }
  const context = {}
  if (value.customerId !== undefined && value.customerId !== null && String(value.customerId).trim() !== '') {
    context.customerId = validateIdentifier(value.customerId, 'customer id')
  }
  if (value.analystId !== undefined && value.analystId !== null && String(value.analystId).trim() !== '') {
    context.analystId = validateIdentifier(value.analystId, 'analyst id')
  }
  if (value.incidentId !== undefined && value.incidentId !== null && String(value.incidentId).trim() !== '') {
    context.incidentId = validateIdentifier(value.incidentId, 'incident id')
  }
  if (value.source !== undefined) context.source = String(value.source).slice(0, 32)
  return Object.freeze(context)
}

export function scopeKeyForTenant(scope, tenant = {}) {
  const kind = normalizeMemoryScopeType(scope)
  const context = normalizeTenantContext(tenant)
  switch (kind) {
    case 'global':
      return 'global'
    case 'analyst':
      if (!context.analystId) throw new Error('memory: analyst context is not resolved by the host')
      return `analyst/${context.analystId}`
    case 'customer':
      if (!context.customerId) throw new Error('memory: customer context is not resolved by the host')
      return `customer/${context.customerId}`
    case 'incident':
      if (!context.customerId || !context.incidentId) {
        throw new Error('memory: customer and incident context must be resolved by the host')
      }
      return `incident/${context.customerId}/${context.incidentId}`
    default:
      throw new Error(`memory: unsupported scope ${kind}`)
  }
}

export function parseScopeKey(value) {
  const key = String(value ?? '').trim()
  if (key === 'global') return { kind: 'global', customerId: undefined, analystId: undefined, incidentId: undefined }
  const parts = key.split('/')
  if (parts.length === 2 && parts[0] === 'analyst') {
    return { kind: 'analyst', analystId: validateIdentifier(parts[1], 'analyst id') }
  }
  if (parts.length === 2 && parts[0] === 'customer') {
    return { kind: 'customer', customerId: validateIdentifier(parts[1], 'customer id') }
  }
  if (parts.length === 3 && parts[0] === 'incident') {
    return {
      kind: 'incident',
      customerId: validateIdentifier(parts[1], 'customer id'),
      incidentId: validateIdentifier(parts[2], 'incident id'),
    }
  }
  throw new Error('memory: invalid resolved scope key')
}

export function assertModelCannotSelectTenant(args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return
  for (const field of MODEL_TENANT_FIELDS) {
    if (Object.hasOwn(args, field)) throw new Error(`memory: ${field} is host-resolved and cannot be supplied by the model`)
  }
  const scope = args.scope
  if (typeof scope === 'string' && scope.includes('/')) {
    throw new Error('memory: scope keys are host-resolved; provide a scope kind only')
  }
}

export function createMemoryContextRegistry(env = process.env) {
  const bound = new WeakMap()
  const defaults = normalizeTenantContext({
    customerId: env.DSH_SOC_CUSTOMER_ID,
    analystId: env.DSH_SOC_ANALYST_ID,
    incidentId: env.DSH_SOC_INCIDENT_ID,
    source: 'deployment-environment',
  })
  return Object.freeze({
    get(agent) {
      return agent !== null && typeof agent === 'object' ? bound.get(agent) ?? defaults : defaults
    },
    set(agent, context) {
      if (agent === null || typeof agent !== 'object') throw new Error('memory: agent is required')
      const normalized = normalizeTenantContext({ ...context, source: 'host' })
      bound.set(agent, normalized)
      return normalized
    },
    clear(agent) {
      if (agent !== null && typeof agent === 'object') bound.delete(agent)
    },
    snapshot(agent) {
      return { ...(agent !== null && typeof agent === 'object' ? bound.get(agent) ?? defaults : defaults) }
    },
    defaultContext: defaults,
  })
}

export function isCustomerBoundScope(scopeKey, tenant) {
  const parsed = parseScopeKey(scopeKey)
  const context = normalizeTenantContext(tenant)
  if (parsed.kind === 'global') return true
  if (parsed.kind === 'analyst') return parsed.analystId === context.analystId
  return parsed.customerId === context.customerId
}
