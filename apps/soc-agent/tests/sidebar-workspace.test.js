import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeEntries, loadOverlayPatches } from '../../../vendor/deepseek-harness/packages/boot/app-boot/lib/index.js'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const read = path => readFileSync(join(repoRoot, path), 'utf8')
const readJson = path => JSON.parse(read(path))
const patchPaths = [
  'vendor/deepseek-harness/packages/bundle/base/cordis.patch.yml',
  'vendor/deepseek-harness/packages/bundle/web-app/cordis.patch.yml',
  'apps/soc-agent/cordis.patch.yml',
]

function composed(extra = []) {
  return composeEntries([
    ...patchPaths.map(path => loadOverlayPatches('SOC composition test', join(repoRoot, path))),
    extra,
  ])
}

function row(rows, id) {
  const found = rows.find(entry => entry.id === id)
  assert.ok(found, `composed row exists: ${id}`)
  return found
}

function walkProductionFiles(root) {
  const files = []
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['lib', 'node_modules', 'tests', '__snapshots__', 'dist'].includes(entry.name)) continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name === 'package.json' || /\.(?:ts|tsx|js|mjs|cjs)$/u.test(entry.name)) files.push(path)
    }
  }
  visit(root)
  return files
}

test('real base + web + SOC composition disables official surfaces and enables one replacement owner', () => {
  const rows = composed()
  assert.equal(row(rows, 'session-folders').disabled, true)
  assert.equal(row(rows, 'ui-sidebar').disabled, true)
  assert.equal(row(rows, 'ui-workspace').disabled, true)
  assert.equal(row(rows, 'soc-agent-client-core').name, 'dsh-soc-agent-client')
  assert.equal(row(rows, 'soc-agent-sidebar-ui').name, 'dsh-soc-agent-sidebar')
  assert.equal(row(rows, 'soc-agent-workspace-ui').name, 'dsh-soc-agent-workspace')

  const optionalRows = [
    ['soc-agent-brand-ui', 'dsh-soc-agent-brand'],
    ['soc-agent-admin-ui', 'dsh-soc-agent-admin'],
    ['soc-agent-action-policy-ui', 'dsh-soc-agent-action-policy'],
    ['soc-agent-attachments-ui', 'dsh-soc-agent-attachments'],
    ['soc-agent-email-draft-ui', 'dsh-soc-agent-email-draft'],
  ]
  for (const [id, name] of optionalRows) {
    const feature = row(rows, id)
    assert.equal(feature.name, name)
    assert.notEqual(feature.disabled, true, `${name} defaults enabled`)
  }

  const sidebarOwners = rows.filter(entry =>
    entry.name === '@deepseek-ai/dsh-client-ui-sidebar' || entry.name === 'dsh-soc-agent-sidebar')
    .filter(entry => entry.disabled !== true)
  assert.deepEqual(sidebarOwners.map(entry => entry.name), ['dsh-soc-agent-sidebar'])
})

test('each optional feature can be disabled without disabling core or the isolated surfaces', () => {
  for (const id of [
    'soc-agent-brand-ui',
    'soc-agent-admin-ui',
    'soc-agent-action-policy-ui',
    'soc-agent-attachments-ui',
    'soc-agent-email-draft-ui',
  ]) {
    const rows = composed([{ id, disabled: true }])
    assert.equal(row(rows, id).disabled, true, `${id} is independently disabled`)
    assert.notEqual(row(rows, 'soc-agent-client-core').disabled, true)
    assert.notEqual(row(rows, 'soc-agent-sidebar-ui').disabled, true)
    assert.notEqual(row(rows, 'soc-agent-workspace-ui').disabled, true)
  }
})

test('optional bundles have explicit core edges and own only their declared surfaces', () => {
  const features = [
    {
      directory: 'soc-agent-brand',
      row: 'soc-agent-brand-ui',
      markers: ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark'],
    },
    {
      directory: 'soc-agent-admin',
      row: 'soc-agent-admin-ui',
      markers: ['soc.admin.content'],
    },
    {
      directory: 'soc-agent-action-policy',
      row: 'soc-agent-action-policy-ui',
      markers: ['conversation.input.left', 'soc-action-policy'],
    },
    {
      directory: 'soc-agent-attachments',
      row: 'soc-agent-attachments-ui',
      markers: ['conversation.input.documents', 'settings.plugin.item', 'attach-file'],
    },
    {
      directory: 'soc-agent-email-draft',
      row: 'soc-agent-email-draft-ui',
      markers: ['tool.call.toolview', 'zimbra_send_email'],
    },
  ]
  for (const feature of features) {
    const manifest = readJson(`packages/${feature.directory}/package.json`)
    assert.equal(manifest.dependencies?.['dsh-soc-agent-client'], 'workspace:*', `${feature.directory} depends on core`)
    assert.ok(manifest.dsh?.client?.inject?.includes('dsh-soc-agent-client'), `${feature.directory} declares the core bundle edge`)
    const packageRoot = join(repoRoot, 'packages', feature.directory)
    const entrySource = read(`packages/${feature.directory}/src/client/index.ts`)
    const source = walkProductionFiles(packageRoot)
      .filter(path => path.includes('/src/'))
      .map(path => readFileSync(path, 'utf8'))
      .join('\n')
    assert.match(entrySource, /export const inject = .*socClient/u, `${feature.directory} injects socClient`)
    if (feature.directory === 'soc-agent-admin') {
      assert.match(entrySource, /surface !== 'admin'/u, `${feature.directory} is admin-only`)
    } else {
      assert.match(entrySource, /surface !== 'workspace'/u, `${feature.directory} is workspace-only`)
    }
    for (const marker of feature.markers) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${feature.directory} owns ${marker}`)
    assert.notEqual(row(composed(), feature.row).disabled, true, `${feature.row} defaults enabled`)
    assert.equal(row(composed([{ id: feature.row, disabled: true }]), feature.row).disabled, true, `${feature.row} can be disabled alone`)
  }
})

test('all first-party production source and manifests stay isolated from official sidebar/workspace implementations', () => {
  const roots = [join(repoRoot, 'apps/soc-agent'), ...readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('soc-agent-'))
    .map(entry => join(repoRoot, 'packages', entry.name))]
  const official = /(?:@deepseek-ai\/)?dsh-client-ui-(?:sidebar|workspace)(?:[/'"`]|$)/u
  const violations = []
  for (const root of roots) {
    for (const path of walkProductionFiles(root)) {
      const source = readFileSync(path, 'utf8')
      if (official.test(source)) violations.push(relative(repoRoot, path))
    }
  }
  assert.deepEqual(violations, [])
})

test('replacement contracts preserve standard child slots and registrations', () => {
  const sidebar = read('packages/soc-agent-sidebar/src/client/index.ts')
  const sidebarContract = read('packages/soc-agent-sidebar/src/client/contract/slots.ts')
  const workspace = read('packages/soc-agent-workspace/src/client/index.ts')
  const workspaceContract = read('packages/soc-agent-workspace/src/client/contract/slots.ts')
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
})

test('all browser package artifacts have explicit provenance and match their pinned source hashes', () => {
  for (const packageDir of ['packages/soc-agent-sidebar', 'packages/soc-agent-workspace']) {
    const manifest = readJson(`${packageDir}/snapshot-baseline.json`)
    assert.equal(manifest.sourceCommit, '56c8dd2', packageDir)
    for (const [path, expected] of Object.entries(manifest.files)) {
      assert.equal(createHash('sha256').update(read(`${packageDir}/${path}`)).digest('hex'), expected, `${packageDir}/${path}`)
    }
  }
})
