import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const read = path => readFileSync(join(repoRoot, path), 'utf8')
const readJson = path => JSON.parse(read(path))

test('SOC composition disables the upstream shell and enables exactly one isolated sidebar owner', () => {
  const patch = read('apps/soc-agent/cordis.patch.yml')
  const app = readJson('apps/soc-agent/package.json')

  assert.match(patch, /- id: session-folders\n  disabled: true/)
  assert.match(patch, /- id: ui-sidebar\n  disabled: true/)
  assert.match(patch, /- id: ui-workspace\n  disabled: true/)
  assert.match(patch, /- id: soc-agent-sidebar-ui\n\s+name: dsh-soc-agent-sidebar/)
  assert.match(patch, /- id: soc-agent-workspace-ui\n\s+name: dsh-soc-agent-workspace/)

  const enabledSidebarRows = [...patch.matchAll(/^\s+- id: [^\n]*sidebar[^\n]*\n(?!\s+disabled: true)[\s\S]*?^\s+name: ([^\n]+)/gm)]
    .map(match => match[1].trim())
  assert.deepEqual(enabledSidebarRows, ['dsh-soc-agent-sidebar'])
  for (const dependency of ['dsh-soc-agent-sidebar', 'dsh-soc-agent-workspace']) {
    assert.equal(app.dependencies[dependency], 'workspace:*', dependency)
  }
})

test('isolated manifests retain the standard host slots without official implementation dependencies', () => {
  const sidebar = readJson('packages/soc-agent-sidebar/package.json')
  const workspace = readJson('packages/soc-agent-workspace/package.json')
  const client = readJson('packages/soc-agent-client/package.json')
  const official = /@deepseek-ai\/dsh-client-ui-(?:sidebar|workspace)|dsh-client-ui-(?:sidebar|workspace)/

  assert.equal(sidebar.name, 'dsh-soc-agent-sidebar')
  assert.equal(workspace.name, 'dsh-soc-agent-workspace')
  assert.equal(sidebar.types, 'lib/types/index.d.ts')
  assert.equal(workspace.types, 'lib/types/index.d.ts')
  assert.ok(read('packages/soc-agent-sidebar/lib/types/client/index.d.ts').length > 0)
  assert.ok(read('packages/soc-agent-workspace/lib/types/client/index.d.ts').length > 0)
  assert.ok(sidebar.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-layout'))
  assert.ok(workspace.dsh.client.inject.includes('dsh-soc-agent-sidebar'))
  assert.equal(client.devDependencies['dsh-soc-agent-sidebar'], 'workspace:*')

  for (const [name, manifest] of [
    ['sidebar', sidebar],
    ['workspace', workspace],
    ['client', client],
  ]) {
    assert.doesNotMatch(JSON.stringify(manifest), official, name)
  }
})

test('isolated source preserves the sidebar child slots and workspace registrations', () => {
  const sidebar = read('packages/soc-agent-sidebar/src/client/index.ts')
  const sidebarContract = read('packages/soc-agent-sidebar/src/client/contract/slots.ts')
  const workspace = read('packages/soc-agent-workspace/src/client/index.ts')
  const workspaceContract = read('packages/soc-agent-workspace/src/client/contract/slots.ts')
  const official = /@deepseek-ai\/dsh-client-ui-(?:sidebar|workspace)/

  assert.match(sidebar, /name: 'sidebar'/)
  for (const slot of [
    'sidebar.brand.mark',
    'sidebar.brand.name',
    'sidebar.workspaces',
    'sidebar.settings',
    'sidebar.footer.action',
  ]) {
    assert.match(sidebar, new RegExp(`'${slot.replaceAll('.', '\\.')}'`), slot)
    assert.match(sidebarContract, new RegExp(`'${slot.replaceAll('.', '\\.')}'`), slot)
  }
  assert.match(workspace, /ctx\.slots\.inject\('sidebar\.workspaces'/)
  assert.match(workspace, /ctx\.slots\.inject\('conversation\.hero\.workspace'/)
  assert.match(workspaceContract, /import type \{\} from 'dsh-soc-agent-sidebar\/client'/)

  for (const [name, source] of [
    ['sidebar', sidebar],
    ['sidebar contract', sidebarContract],
    ['workspace', workspace],
    ['workspace contract', workspaceContract],
    ['client index', read('packages/soc-agent-client/src/client/index.ts')],
    ['client branding', read('packages/soc-agent-client/src/client/CiticBrand.tsx')],
  ]) {
    assert.doesNotMatch(source, official, name)
  }
})

test('isolated packages keep the checked-in Harness CSS snapshot', () => {
  const cssPairs = [
    ['packages/soc-agent-sidebar/src/client/SidebarRoot.module.css', 'vendor/deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.module.css'],
    ['packages/soc-agent-workspace/src/client/WorkspaceBrowser.module.css', 'vendor/deepseek-harness/packages/client/ui-workspace/src/client/WorkspaceBrowser.module.css'],
    ['packages/soc-agent-workspace/src/client/WorkspacePicker.module.css', 'vendor/deepseek-harness/packages/client/ui-workspace/src/client/WorkspacePicker.module.css'],
    ['packages/soc-agent-workspace/src/client/rows/Rows.module.css', 'vendor/deepseek-harness/packages/client/ui-workspace/src/client/rows/Rows.module.css'],
  ]

  for (const [isolatedPath, officialPath] of cssPairs) {
    assert.equal(read(isolatedPath), read(officialPath), isolatedPath)
  }
})
