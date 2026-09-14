import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveOfficialSplunkConfig } from '../splunk-bridge.js'

test('Harness patch enables the filesystem skill and plan review layers', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const patch = readFileSync(join(productRoot, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- id: skill\n  disabled: false/)
  assert.match(patch, /- id: skill-filesystem\n  disabled: false[\s\S]*customSkillDirs:[\s\S]*MCP_SERVER_ROOT/)
  assert.match(patch, /- id: tool-skill\n  disabled: false/)
  assert.match(patch, /- id: skill-badge\n  disabled: true/)
  assert.match(patch, /- id: ui-skill\n  disabled: false/)
  assert.match(patch, /- id: plan-mode\n  disabled: false/)
  assert.match(patch, /- id: ui-plan\n  disabled: false/)
  assert.match(patch, /- id: ui-user-questions\n  disabled: false/)
  assert.match(patch, /- id: session-folders\n  disabled: true/)
})

test('CITIC SOC loads generic Splunk background with the startup instructions', () => {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  const presetRoot = join(repoRoot, 'vendor/deepseek-harness/apps/cli/config/agent-presets')
  const citicPreset = readFileSync(join(presetRoot, 'citic-soc/agent.cordis.yml'), 'utf8')
  const background = readFileSync(join(repoRoot, 'BACKGROUND.md'), 'utf8')
  const detection = readFileSync(join(repoRoot, 'skills', 'detection-engineering', 'SKILL.md'), 'utf8')

  assert.match(citicPreset, /instructionFileCandidates:\n\s+- AGENTS\.md\n\s+- CLAUDE\.md\n\s+- BACKGROUND\.md/)
  assert.doesNotMatch(citicPreset, /deferredInstructionFileCandidates|deferredToolNamePrefixes/)
  assert.equal((citicPreset.match(/BACKGROUND\.md/g) ?? []).length, 1)
  assert.match(background, /not\s+authorization/i)
  assert.match(background, /\[COMPANY_SHORT\] detection alert name/)
  assert.match(background, /\[Fubon\] 7732_Malicious File\/Exploit Download_Checkpoint FW/)
  assert.match(background, /Ruleset\.csv/)
  assert.match(background, /must\s+not be treated as a\s+customer abbreviation/i)
  assert.doesNotMatch(background, /^## Usual detection creation workflow$/m)
  assert.doesNotMatch(background, /Trigger Actions/)
  assert.doesNotMatch(background, /RULE_NUMBER/)
  assert.doesNotMatch(background, /outputcsv/)
  assert.match(detection, /Ruleset\.csv/)
  assert.match(detection, /not already used.*`0000`–`9999`/is)
  assert.match(detection, /catalog maintenance to the external human process/i)
  assert.doesNotMatch(detection, /catalog_(?:list|write|update|archive)/i)
  assert.match(detection, /Trigger Actions/i)
  assert.match(detection, /alert\.track=true/)
  assert.match(detection, /action\.logevent=1/)
  assert.match(detection, /RULE_NUMBER/)
  assert.match(detection, /outputcsv/)
  assert.doesNotMatch(background, /^## What Splunk is$/m)
  assert.doesNotMatch(background, /^## How the SOC Agent uses Splunk$/m)
  assert.doesNotMatch(background, /^## Splunk Web UI and REST API$/m)

  for (const preset of ['standard', 'code', 'cordis']) {
    const content = readFileSync(join(presetRoot, preset, 'agent.cordis.yml'), 'utf8')
    assert.doesNotMatch(content, /BACKGROUND\.md/, preset)
  }
})

test('SOC profile disables native shell and permission controls', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const patch = readFileSync(join(productRoot, 'cordis.patch.yml'), 'utf8')
  for (const id of ['subprocess', 'sandbox', 'bash-sandbox', 'permission', 'ui-permission', 'tool-bash', 'tool-pwsh']) {
    assert.match(patch, new RegExp(`- id: ${id}\\n  disabled: true`), id)
  }
})

test('SOC profile exposes only allowlisted official Splunk reads when configured', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const patch = readFileSync(join(productRoot, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- id: splunk-official-mcp\n\s+name: dsh-soc-agent\/splunk-bridge/)
  assert.equal(resolveOfficialSplunkConfig({}, '/missing'), undefined)
  const config = resolveOfficialSplunkConfig({ SPLUNK_MCP_ENDPOINT: 'https://splunk.test/mcp', SPLUNK_TOKEN: 'test-token' }, '/missing')
  assert.equal(config.transport, 'streamable-http')
  assert.equal(config.headers.Authorization, 'Bearer test-token')
  assert.equal(config.verifyTls, true)
  for (const name of ['splunk_run_query', 'splunk_get_indexes', 'splunk_get_metadata', 'splunk_get_knowledge_objects', 'splunk_run_saved_search', 'splunk_list_fired_alerts']) {
    assert.ok(config.allowedToolNames.includes(name))
  }
  assert.ok(config.allowedToolNames.every(name => !/splunk_(create|update|delete|write)_/.test(name)))
})

test('soc_agent MCP allowlist contains only Zimbra and subscription tools', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const patch = readFileSync(join(productRoot, 'cordis.patch.yml'), 'utf8')
  const start = patch.indexOf('- id: soc-agent-mcp')
  const end = patch.indexOf('- id: splunk-official-mcp', start)
  const socBlock = patch.slice(start, end)
  const expected = [
    'zimbra_list_folders', 'zimbra_list_signatures', 'zimbra_create_signature',
    'zimbra_delete_signature', 'zimbra_create_folder', 'zimbra_search_emails',
    'zimbra_get_email', 'zimbra_get_email_headers', 'zimbra_get_attachment_text',
    'zimbra_send_email', 'zimbra_use_signature_on_email', 'zimbra_move_email',
    'zimbra_list_email_filters', 'zimbra_get_email_filter',
    'zimbra_validate_email_filter', 'zimbra_preview_email_filter_update',
    'zimbra_create_email_filter', 'zimbra_update_email_filter',
    'zimbra_delete_email_filter', 'zimbra_set_email_filter_enabled',
    'zimbra_reorder_email_filter', 'list_subscriptions', 'get_subscription_schema',
    'preview_subscription', 'create_subscription', 'update_subscription',
    'delete_subscription',
  ]
  const allowlist = socBlock.match(/allowedToolNames:\n([\s\S]*?)(?=\n\s*#|\n\s*toolCallTimeoutMs)/)?.[1] ?? ''
  const actual = [...allowlist.matchAll(/^\s+- ([a-z][a-z_]*)$/gm)].map(match => match[1])
  assert.deepEqual(actual, expected)
  assert.doesNotMatch(socBlock, /splunk_/)
})
