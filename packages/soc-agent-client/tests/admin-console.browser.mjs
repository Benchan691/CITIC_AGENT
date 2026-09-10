import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from '../../../vendor/deepseek-harness/apps/web/node_modules/vite/dist/node/index.js'
import { chromium } from '../../../vendor/deepseek-harness/apps/web/node_modules/playwright/index.mjs'
const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({ root, configFile:false, server:{host:'127.0.0.1',port:0}, esbuild:{jsx:'automatic'}, resolve:{alias:{'react-dom/client':fileURLToPath(new URL('../../../vendor/deepseek-harness/apps/web/node_modules/react-dom/client.js',import.meta.url))}} })
await server.listen()
const browser = await chromium.launch({headless:true})
const page = await browser.newPage({viewport:{width:1440,height:1050}})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('dialog',dialog=>dialog.accept())
let authenticated=true
let unavailable=false
const writes=[]
const data={runtime:{enabled:false,configured:false},customers:[{id:'customer-a',record_id:'customer-a',revision:1,cid:'CPC001',gid:'DEMO-A',name:'Example customer',display_name:'Example customer',lifecycle_status:'active',alert_delivery_enabled:true,email_config:{recipients:['soc@example.test'],cc:[],bcc:[],language:'EN',brand:'CPC'}},{id:'customer-b',record_id:'customer-b',revision:1,cid:'CPC002',gid:'DEMO-B',name:'Second customer',display_name:'Second customer',lifecycle_status:'provisioning',alert_delivery_enabled:false,email_config:{recipients:[]}}],rules:[{id:'rule-a',name:'Critical infrastructure',customer_id:'customer-a',severities:['high','critical'],enabled:true,routing:{}}],source_types:[{id:'source-a',name:'Firewall'}],history:[{event_id:'event-fixture-001',eid:'CPC001-0000-20260909T081530123456Z-000001',cid:'CPC001',aid:'CPC001-0000',customer_id:'customer-a',customer:'Example customer',status:'uncertain',created:'2026-09-08T06:00:00Z',accepted:[],rejected:{},error:'Relay acknowledgement interrupted'}],delivery:{uncertain:1,failed:0},metrics:{registration_reviews:1,held_events:0,missing_deliveries:1,queue_age_seconds:30,discovery_incomplete_24h:0,publication_failures:0},alert_index_ownership:[{id:'ownership-a',deployment:'splunk-prod',index_name:'CPC_security',customer_id:'customer-a',cid:'CPC001',status:'active',verified_at:'2026-09-09T08:00:00Z',naming_compliant:true}],alert_registrations:[{id:'registration-a',customer_id:'customer-a',cid:'CPC001',aid:'CPC001-0000',saved_search_name:'Human alert',deployment:'splunk-prod',app:'search',owner:'nobody',source_indexes:['CPC_security'],registration_state:'active',delivery_state:'ready',delivery_enabled:true,presence_state:'present',publication_state:'published',definition_revision:1,action_configured:true}],alert_registration_review:[{id:'review-a',deployment:'splunk-prod',app:'search',owner:'nobody',saved_search_name:'Macro alert',source_indexes:['CPC_security'],reason:'unresolved macro requires administrator review',attempt_count:1}],alert_policies:[{id:'policy-a',customer_id:'customer-a',registration_id:null,revision:1,policy:{detail_columns:['device'],required_columns:['device'],optional_columns:[],field_mappings:[{source:'device',label:'Device',required:true}],row_filters:[],severity_source:'severity',severity_mapping:{critical:'critical'},severity_fallback:'unknown',max_display_rows:50,max_stored_rows:1000}}],alert_quarantine:[],migration_report:{legacy_events:1,eligible_backfills:0}}
await page.route('**/admin/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname
 let body={}
 if(path==='/admin/auth/me') body={authenticated,email:'admin@example.test'}
 else if(path.endsWith('/settings')) { if(unavailable) {await route.fulfill({status:503,json:{error:'Fixture unavailable'}});return}; body=data }
 else if(req.method()==='POST') {
   const payload=req.postDataJSON();writes.push({path,payload})
   if(path.endsWith('/migration/preview')) body={run_id:'migration-preview-001'}
   else if(path.endsWith('/preview')) body='csv' in payload ? {rows:[{row:1,status:'unapplied',error:'Source type requires exact mapping'}]} : {subject:'[SOC] Preview fixture',html:'<p>Safe fixture preview</p>',text:'Safe fixture preview',recipients:{recipients:['soc@example.test'],bcc:['hidden@example.test']},matched_rules:[],delivery_mode:'registered_snapshot',eligible:true}
   else if(path.endsWith('/customer')) {data.customers.find(c=>c.id===payload.customer_id).email_config=payload.email_config; body={ok:true}}
   else if(path.endsWith('/rule')) {const i=data.rules.findIndex(r=>r.id===payload.id);if(i>=0)data.rules[i]=payload;else data.rules.push({...payload,id:'new-rule'});body={ok:true}}
   else if(path.endsWith('/ownership')) {data.alert_index_ownership.push({...payload,id:'ownership-new',cid:data.customers.find(c=>c.id===payload.customer_id)?.cid,verified_at:'2026-09-10T08:00:00Z'});body={ok:true}}
   else if(path.endsWith('/policy/remove')) {data.alert_policies=data.alert_policies.filter(item=>item.registration_id!==payload.registration_id);body={ok:true}}
   else if(path.endsWith('/policy')) {const i=data.alert_policies.findIndex(item=>item.customer_id===payload.customer_id&&(item.registration_id||null)===(payload.registration_id||null));const record={id:i>=0?data.alert_policies[i].id:'policy-new',customer_id:payload.customer_id,registration_id:payload.registration_id||null,revision:i>=0?(data.alert_policies[i].revision||0)+1:1,policy:payload.policy};if(i>=0)data.alert_policies[i]=record;else data.alert_policies.push(record);body=record}
   else if(path.endsWith('/review/resolve')) {data.alert_registration_review=data.alert_registration_review.filter(item=>item.id!==payload.review_id);data.alert_registrations.push({id:'registration-review',customer_id:payload.customer_id,cid:'CPC001',aid:'CPC001-0001',saved_search_name:'Macro alert',deployment:'splunk-prod',app:'search',owner:'nobody',source_indexes:payload.source_indexes,registration_state:'active',delivery_state:'action_missing',delivery_enabled:false,presence_state:'present',publication_state:'unpublished',definition_revision:1,action_configured:false});body={aid:'CPC001-0001'}}
   else if(path.endsWith('/registration')) {const item=data.alert_registrations.find(item=>item.id===payload.registration_id);item.delivery_enabled=payload.enabled;body={ok:true}}
   else if(path.endsWith('/relink')) body={ok:true}
   else if(path.endsWith('/migration/backfill')) body={run_id:payload.preview_run_id}
   else if(path.endsWith('/release')) body={ok:true}
   else throw new Error('Unexpected fixture POST '+path)
 } else throw new Error('Unexpected fixture request '+path)
 await route.fulfill({json:body})
})
try {
 await page.goto(server.resolvedUrls.local[0]+'tests/admin-preview/index.html')
 await page.getByRole('heading',{name:'Overview',exact:true}).waitFor()
 await page.getByText('3 / 4',{exact:true}).waitFor()
 assert.equal(writes.length,0,'Opening the dashboard must not write')
 await page.screenshot({path:'/tmp/sentinel-admin-overview.png',fullPage:true})
 await page.getByRole('link').filter({hasText:'Delivery needs attention'}).click()
 await page.getByLabel('Delivery status').waitFor()

 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Connections',exact:true}).click()
 await page.getByRole('button',{name:'Check connection'}).first().click()
 await page.getByText('Test connection unavailable',{exact:true}).waitFor()
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'AI providers',exact:true}).click()
 await page.getByRole('heading',{name:'Example AI',exact:true}).waitFor()
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Customers',exact:true}).click()
 await page.getByRole('heading',{name:'Customer Information',exact:true}).waitFor()
 await page.getByText('1 record(s)',{exact:true}).waitFor()
 await page.getByRole('button',{name:'New record',exact:true}).click()
 await page.getByLabel('customer code',{exact:true}).fill('new-customer')
 await page.getByLabel('display name',{exact:true}).fill('New customer')
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByText('New customer',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Edit',exact:true}).click()
 await page.getByLabel('display name',{exact:true}).fill('Updated customer')
 await page.getByRole('button',{name:'Save',exact:true}).click()
 await page.getByText('Updated customer',{exact:true}).waitFor()
 await page.getByRole('button',{name:'Archive',exact:true}).click()
 await page.getByText('archived',{exact:false}).first().waitFor()
 await page.getByRole('button',{name:'Restore',exact:true}).click()
 await page.getByRole('button',{name:'Archive',exact:true}).waitFor()
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Alert email',exact:true}).click()
 await page.getByRole('button',{name:'Edit Critical infrastructure'}).click()
 await page.getByLabel('Rule name',{exact:true}).fill('Infrastructure alerts')
 await page.getByLabel('Enable this rule for new alerts').uncheck()
 await page.getByRole('button',{name:'Save rule',exact:true}).click()
 await page.getByText('Notification rule saved.',{exact:true}).waitFor()
 assert.equal(writes.at(-1).payload.id,'rule-a')
 assert.equal(writes.at(-1).payload.enabled,false)
 await page.getByRole('button',{name:'Identity & policies',exact:true}).click()
 await page.getByRole('heading',{name:'Verified deployment/index ownership',exact:true}).waitFor()
 await page.getByLabel('Exact index name',{exact:true}).fill('CPC_archive')
 await page.getByRole('button',{name:'Verify and save ownership',exact:true}).click()
 await page.getByText('Index CPC_archive ownership saved.',{exact:true}).waitFor()
 assert.equal(writes.at(-1).path,'/admin/alert-email/ownership')
 const customerPolicy=page.getByRole('form',{name:'Alert email policy for Example customer'}).first()
 await customerPolicy.getByLabel(/Detail columns/).fill('device\nsource_ip')
 await customerPolicy.getByLabel('Optional columns',{exact:true}).fill('hostname')
 await customerPolicy.getByRole('button',{name:'Save policy',exact:true}).click()
 await page.getByText('Email policy for CPC001 saved.',{exact:true}).waitFor()
 assert.deepEqual(writes.at(-1).payload.policy.detail_columns,['device','source_ip'])
 assert.deepEqual(writes.at(-1).payload.policy.optional_columns,['hostname'])
 await page.getByRole('button',{name:'Approve scope and allocate AID',exact:true}).click()
 await page.getByText('Review for Macro alert resolved and its AID allocated.',{exact:true}).waitFor()
 assert.equal(writes.at(-1).path,'/admin/alert-email/review/resolve')
 assert.deepEqual(writes.at(-1).payload.source_indexes,['CPC_security'])
 await page.getByRole('button',{name:'Preview migration',exact:true}).click()
 await page.getByText(/Migration preview migration-preview-001 generated/).waitFor()
 await page.getByRole('button',{name:'Apply reviewed preview',exact:true}).click()
 assert.equal(writes.at(-1).payload.preview_run_id,'migration-preview-001')
 await page.getByRole('button',{name:'Customer defaults',exact:true}).click()
 await page.getByRole('button',{name:'Open customer catalog'}).first().click()
 await page.getByRole('heading',{name:'Customer Information',exact:true}).waitFor()
 await page.getByLabel('display name',{exact:true}).waitFor()
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Alert email',exact:true}).click()
 await page.getByRole('button',{name:'Preview email',exact:true}).click()
 await page.getByLabel('Event UUID',{exact:true}).fill('event-fixture-001')
 await page.getByRole('button',{name:'Preview email',exact:true}).last().click()
 await page.getByText('[SOC] Preview fixture',{exact:true}).waitFor()
 assert.equal(await page.getByTitle('Alert email preview').getAttribute('sandbox'),'')
 await page.getByRole('button',{name:'Delivery history',exact:true}).click()
 await page.getByLabel('Delivery status').selectOption('accepted')
 await page.getByText('No deliveries match these filters.').waitFor()
 await page.getByLabel('Delivery status').selectOption('uncertain')
 await page.getByText('0 accepted · 0 rejected').click()
 await page.getByText('Relay acknowledgement interrupted').waitFor()
 await page.screenshot({path:'/tmp/sentinel-admin-email.png',fullPage:true})
 await page.getByRole('button',{name:'Import routes',exact:true}).click()
 await page.getByLabel('CSV content').fill('source_type,severity,recipients\nUnknown,high,a@example.test')
 await page.getByRole('button',{name:'Preview import',exact:true}).click()
 await page.getByText('Source type requires exact mapping').waitFor()
 assert.equal(await page.getByRole('button',{name:'Save disabled routes'}).count(),0)
 await page.setViewportSize({width:390,height:844})
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Overview',exact:true}).click()
 await page.screenshot({path:'/tmp/sentinel-admin-mobile.png',fullPage:true})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile page overflow')
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Alert email',exact:true}).click()
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No mobile email page overflow')
 await page.getByRole('navigation',{name:'Administration'}).getByRole('link',{name:'Overview',exact:true}).click()
 unavailable=true
 await page.getByRole('button',{name:'Refresh status',exact:true}).click()
 await page.getByText('Some status information is unavailable. Refresh to try again.').waitFor()
 authenticated=false
 await page.reload()
 await page.getByRole('button',{name:'Sign in',exact:true}).waitFor()
 assert.equal(await page.getByRole('navigation',{name:'Administration'}).count(),0,'Signed-out users see no admin controls')
 assert.deepEqual(errors,[])
 console.log('Admin browser checks passed: overview, service failure, providers, rules, verified ownership, AID review, policies, migration binding, preview isolation, history filters, import mapping, and mobile layout.')
} finally {await browser.close();await server.close()}
