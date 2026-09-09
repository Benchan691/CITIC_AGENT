// Browser-only test fixture. All requests are intercepted by the test runner.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { AdminConsole } from '../../src/client/AdminConsole'

const ok = (value: unknown) => ({ result: { ok: true, value } })
const rpcOk = (value: unknown) => ({ ok: true, value })
const customers = [{ catalog: 'customer', record_id: 'customer-a', customer_code: 'demo', display_name: 'Example customer', short_name: 'Demo', gid: 'Default', lifecycle_status: 'active', notes: '', source_type_id: '', related_staff_id: '', splunk_indexes: [], field_mapping: { username: '', hostname: '', src_ip: '', dest_ip: '', event_id: '', title: '', description: '', severity: '', status: '' }, email_config: { recipients: ['soc@example.test'], cc: [], bcc: [], language: 'EN', brand: 'CPC' }, revision: 1, archived: false }]
const connection = {
  rpc: { call: async (_channel: string, name: string, payload: Record<string, unknown> = {}) => {
    if (name === 'test-splunk') return { ok: false, error: { message: 'Test connection unavailable' } }
    if (name === 'catalog-list') return rpcOk({ items: customers, total: customers.length })
    if (name === 'catalog-get') return rpcOk({ record: customers.find(item => item.record_id === payload.record_id) })
    if (name === 'catalog-customer-options') return rpcOk({ source_types: [{ id: 'source-a', name: 'Firewall' }], staff: [{ id: 'staff-a', name: 'Analyst', email: 'analyst@example.test', role: 'analyst' }] })
    if (name === 'catalog-history') return rpcOk({ history: [] })
    if (name === 'save-catalog-record') {
      const draft = payload.record as Record<string, unknown>
      if (payload.operation === 'write') {
        const record = { catalog: 'customer', record_id: `customer-${customers.length + 1}`, ...draft, revision: 1, archived: false }
        customers.push(record as typeof customers[number])
        return rpcOk({ saved: true, created: true, record })
      }
      const index = customers.findIndex(item => item.record_id === payload.record_id)
      const record = { ...customers[index], ...draft, revision: Number(customers[index].revision) + 1 }
      customers[index] = record as typeof customers[number]
      return rpcOk({ saved: true, updated: true, record })
    }
    if (name === 'archive-catalog-record') {
      const index = customers.findIndex(item => item.record_id === payload.record_id)
      const record = { ...customers[index], archived: payload.restore !== true, revision: Number(customers[index].revision) + 1 }
      customers[index] = record as typeof customers[number]
      return rpcOk({ saved: true, record })
    }
    return { ok: true, value: { services: { splunk: {status:'ready'}, zimbra: {status:'ready'}, markitdown: {status:'ready'}, subscription_server: {status:'not_configured'} } } }
  } },
  api: {
    settings: { describe: async () => ok({writable:true,namespaces:[{ns:'llm-pi-ai',value:{providers:{example:{models:[{id:'example-model'}]}}},revision:1,writable:true}]}), mutate: async () => ok({}) },
    llm: { providers: async () => ok({ providers:[{provider:'example',displayName:'Example AI',settingsNs:'llm-pi-ai',settingsPath:['providers','example'],declared:true}] }), discoverModels:async () => ok({models:[]}) },
    credentials: { describe:async () => ok({credentials:{EXAMPLE_API_KEY:{configured:true,writable:true}}}), set:async () => ok({}), unset:async () => ok({}) },
  },
}
createRoot(document.getElementById('root')!).render(<AdminConsole connection={connection} />)
