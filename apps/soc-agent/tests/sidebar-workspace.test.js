import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { composeEntries, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { replacements } from '../../../tooling/replacement-map.mjs'

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
      if (['node_modules', 'tests', '__tests__', '__snapshots__'].includes(entry.name)) continue
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
  for (const id of [
    'typert-gateway', 'agent', 'agent-loop', 'settings', 'llm-pi-ai',
    'session-persistence-jsonl', 'agent-instructions', 'tool-result-pruner',
    'connection', 'file-upload', 'api-remotes',
    'session-controller', 'workspace-controller', 'workspace-files',
    'settings-controller', 'session-log-download', 'ui-layout', 'ui-renderer',
    'ui-session', 'ui-sidebar', 'ui-workspace', 'ui-conversation', 'ui-chat',
    'ui-approval', 'ui-commands', 'ui-input-trigger', 'ui-model-selection',
    'ui-attachment', 'ui-brand-official',
  ]) assert.equal(row(rows, id).disabled, true, `${id} is disabled`)
  assert.equal(row(rows, 'soc-agent-time-context').name, 'dsh-soc-agent-time-context')
  assert.equal(row(rows, 'soc-agent-mcp').name, 'dsh-soc-agent-mcp-client')
  assert.match(read('apps/soc-agent/cordis.patch.yml'), /- id: session-folders\n\s+disabled: true/u)
  assert.equal(row(rows, 'soc-agent-client-core').name, 'dsh-soc-agent-client')
  assert.equal(row(rows, 'soc-agent-sidebar-ui').name, 'dsh-soc-agent-sidebar')
  assert.equal(row(rows, 'soc-agent-workspace-ui').name, 'dsh-soc-agent-workspace')

  const optionalRows = [
    ['soc-agent-brand-ui', 'dsh-soc-agent-brand'],
    ['soc-agent-admin-ui', 'dsh-soc-agent-admin'],
    ['soc-agent-action-policy-ui', 'dsh-soc-agent-action-policy'],
    ['soc-agent-attachments-ui', 'dsh-soc-agent-attachments'],
    ['soc-agent-email-draft-ui', 'dsh-soc-agent-email-draft'],
    ['soc-agent-auto-collapse', 'dsh-soc-agent-auto-collapse'],
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
    'soc-agent-auto-collapse',
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
      markers: ['conversation.input.attachments', 'settings.plugin.item', 'attach-file'],
    },
    {
      directory: 'soc-agent-email-draft',
      row: 'soc-agent-email-draft-ui',
      markers: ['tool.call.toolview', 'zimbra_send_email'],
    },
    {
      directory: 'soc-agent-auto-collapse',
      row: 'soc-agent-auto-collapse',
      markers: ['dsh-auto-collapse', 'socAutoCollapse'],
    },
  ]
  for (const feature of features) {
    const manifest = readJson(`packages/${feature.directory}/package.json`)
    assert.equal(manifest.peerDependencies?.['dsh-soc-agent-client'], '0.1.0', `${feature.directory} has an exact runtime peer on core`)
    assert.match(manifest.devDependencies?.['dsh-soc-agent-client'], /^workspace:/u, `${feature.directory} develops against the workspace core`)
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

test('all first-party production source and manifests stay isolated from every replaced official implementation', () => {
  const roots = [join(repoRoot, 'apps/soc-agent'), ...readdirSync(join(repoRoot, 'packages'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('soc-agent-'))
    .map(entry => join(repoRoot, 'packages', entry.name))]
  const violations = []
  for (const root of roots) {
    for (const path of walkProductionFiles(root)) {
      const source = readFileSync(path, 'utf8')
      for (const replacement of replacements) {
        const pattern = new RegExp(`${replacement.officialName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}(?:[/\"'\x60]|$)`, 'u')
        if (pattern.test(source)) violations.push(`${relative(repoRoot, path)} -> ${replacement.officialName}`)
      }
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

test('every fork records immutable rc.2 source provenance', () => {
  for (const replacement of replacements) {
    const manifest = readJson(`packages/${replacement.packageDir}/UPSTREAM_BASELINE.json`)
    assert.equal(manifest.commit, 'fb2c4b9e698e30edb738bca4cf0618587db7d203')
    assert.equal(manifest.officialSourcePath, replacement.sourcePath)
    assert.match(manifest.sourceSha256, /^[a-f0-9]{64}$/u)
  }
})

test('sidebar and workspace visual snapshots record their rc.2 provenance', () => {
  for (const [packageDir, sourcePath, screenshotKeys] of [
    ['soc-agent-sidebar', 'packages/client/ui-sidebar', ['expanded', 'collapsed']],
    ['soc-agent-workspace', 'packages/client/ui-workspace', ['list', 'picker']],
  ]) {
    const snapshot = readJson(`packages/${packageDir}/snapshot-baseline.json`)
    assert.equal(snapshot.baselineCommit, '56c8dd21492a5c36cb9f3eaa3da01160aba40033')
    assert.equal(snapshot.upstream.commit, 'fb2c4b9e698e30edb738bca4cf0618587db7d203')
    assert.equal(snapshot.upstream.sourcePath, sourcePath)
    assert.match(snapshot.upstream.sourceSha256, /^[a-f0-9]{64}$/u)
    assert.match(snapshot.socSourceSha256, /^[a-f0-9]{64}$/u)
    for (const key of screenshotKeys) assert.match(snapshot.screenshots[key], /^apps\/soc-agent\/tests\/__screenshots__\/.*\.png$/u)
  }
})
