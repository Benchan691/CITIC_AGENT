// Browser-only test fixture. All requests are intercepted by the test runner.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { AdminConsole } from '../../src/client/AdminConsole'

const ok = (value: unknown) => ({ result: { ok: true, value } })
const connection = {
  rpc: { call: async (_channel: string, name: string) => {
    if (name === 'test-splunk') return { ok: false, error: { message: 'Test connection unavailable' } }
    return { ok: true, value: { services: { splunk: {status:'ready'}, zimbra: {status:'ready'}, markitdown: {status:'ready'}, subscription_server: {status:'not_configured'} } } }
  } },
  api: {
    settings: { describe: async () => ok({writable:true,namespaces:[{ns:'llm-pi-ai',value:{providers:{example:{models:[{id:'example-model'}]}}},revision:1,writable:true}]}), mutate: async () => ok({}) },
    llm: { providers: async () => ok({ providers:[{provider:'example',displayName:'Example AI',settingsNs:'llm-pi-ai',settingsPath:['providers','example'],declared:true}] }), discoverModels:async () => ok({models:[]}) },
    credentials: { describe:async () => ok({credentials:{EXAMPLE_API_KEY:{configured:true,writable:true}}}), set:async () => ok({}), unset:async () => ok({}) },
  },
}
createRoot(document.getElementById('root')!).render(<AdminConsole connection={connection} />)
