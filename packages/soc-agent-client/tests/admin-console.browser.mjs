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
const data={runtime:{enabled:false,configured:false},customers:[{id:'customer-a',gid:'DEMO-A',name:'Example customer',email_config:{recipients:['soc@example.test'],cc:[],bcc:[],language:'EN',brand:'CPC'}},{id:'customer-b',gid:'DEMO-B',name:'Second customer',email_config:{recipients:['team@example.test']}}],rules:[{id:'rule-a',name:'Critical infrastructure',customer_id:'customer-a',severities:['high','critical'],enabled:true,routing:{}}],source_types:[{id:'source-a',name:'Firewall'}],history:[{event_id:'event-fixture-001',customer:'DEMO-A',status:'uncertain',created:'2026-09-08T06:00:00Z',accepted:[],rejected:{},error:'Relay acknowledgement interrupted'}],delivery:{uncertain:1,failed:0}}
await page.route('**/admin/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname
 let body={}
 if(path==='/admin/auth/me') body={authenticated,email:'admin@example.test'}
 else if(path.endsWith('/settings')) { if(unavailable) {await route.fulfill({status:503,json:{error:'Fixture unavailable'}});return}; body=data }
 else if(req.method()==='POST') {
   const payload=req.postDataJSON();writes.push({path,payload})
   if(path.endsWith('/preview')) body='csv' in payload ? {rows:[{row:1,status:'unapplied',error:'Source type requires exact mapping'}]} : {subject:'[SOC] Preview fixture',html:'<p>Safe fixture preview</p>',text:'Safe fixture preview',recipients:{recipients:['soc@example.test'],bcc:['hidden@example.test']},matched_rules:['Critical infrastructure']}
   else if(path.endsWith('/customer')) {data.customers.find(c=>c.id===payload.customer_id).email_config=payload.email_config; body={ok:true}}
   else if(path.endsWith('/rule')) {const i=data.rules.findIndex(r=>r.id===payload.id);if(i>=0)data.rules[i]=payload;else data.rules.push({...payload,id:'new-rule'});body={ok:true}}
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
 await page.getByRole('button',{name:'Customer defaults',exact:true}).click()
 await page.getByLabel('Email language').selectOption('ZH')
 await page.getByRole('button',{name:'Save defaults',exact:true}).click()
 await page.getByText('Customer defaults saved.',{exact:true}).waitFor()
 assert.equal(writes.at(-1).payload.email_config.language,'ZH')
 await page.getByRole('button',{name:'Preview email',exact:true}).click()
 await page.getByLabel('Event ID',{exact:true}).fill('event-fixture-001')
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
 console.log('Admin browser checks passed: overview, service failure, providers, rule save, customer defaults, preview isolation, history filters, import mapping, mobile layout.')
} finally {await browser.close();await server.close()}
