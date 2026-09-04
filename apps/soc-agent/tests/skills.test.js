import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { SOC_UNSUPPORTED_WEB_TESTS } from './web-test-policy.js'

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

test('CITIC SOC defers generic Splunk background until a Splunk tool is visible', () => {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  const presetRoot = join(repoRoot, 'vendor/deepseek-harness/apps/cli/config/agent-presets')
  const citicPreset = readFileSync(join(presetRoot, 'citic-soc/agent.cordis.yml'), 'utf8')
  const background = readFileSync(join(repoRoot, 'BACKGROUND.md'), 'utf8')
  const detection = readFileSync(join(repoRoot, 'skills', 'detection-engineering', 'SKILL.md'), 'utf8')

  assert.match(citicPreset, /instructionFileCandidates:\n\s+- AGENTS\.md\n\s+- CLAUDE\.md\n\s+deferredInstructionFileCandidates:\n\s+- BACKGROUND\.md\n\s+deferredToolNamePrefixes:\n\s+- mcp__soc_agent__splunk_/)
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
  assert.match(detection, /create the corresponding row/i)
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

test('Harness discovers and loads the repository SOC skills through the skill tool', () => {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  const harnessRoot = fileURLToPath(new URL('../../../vendor/deepseek-harness/', import.meta.url))
  const isolatedHome = mkdtempSync(join(tmpdir(), 'dsh-skill-layer-test-'))
  const script = `(async () => {
    const { default: assert } = await import('node:assert/strict')
    const { join } = await import('node:path')
    const { Context } = await import('@deepseek-ai/cordis')
    const { default: AgentRegistry } = await import('@deepseek-ai/dsh-agent')
    const { default: SkillRegistry } = await import('@deepseek-ai/dsh-skill')
    const SkillFileSystem = await import('@deepseek-ai/dsh-skill-filesystem')
    const toolSkill = await import('@deepseek-ai/dsh-tool-skill')
    const { default: SystemPrompt } = await import('@deepseek-ai/dsh-system-prompt')
    const { default: ToolRuntime } = await import('@deepseek-ai/dsh-tools')

    const repoRoot = ${JSON.stringify(repoRoot)}
    const home = ${JSON.stringify(isolatedHome)}
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(SkillRegistry)
    await ctx.plugin(SkillFileSystem, {
      dshHome: join(home, '.dsh'),
      agentsHome: join(home, '.agents'),
      customSkillDirs: [join(repoRoot, 'skills')],
      watch: false,
    })
    await ctx.plugin(toolSkill)

    const expected = [
      'soc-incident-triage',
      'email-to-splunk-investigation',
      'splunk-investigation',
      'detection-engineering',
      'false-positive-analysis',
      'soc-shift-operations',
      'zimbra-operations',
      'spl-writing',
    ]
    const names = (await ctx.skills.list({ cwd: repoRoot })).map(skill => skill.name)
    for (const name of expected) assert.equal(names.includes(name), true, name)
    assert.equal(ctx.tools.schemas().map(tool => tool.name).includes('skill'), true)

    const loaded = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: 'skill-layer-test',
      name: 'skill',
      arguments: { name: 'splunk-investigation' },
    })
    assert.equal(loaded.isError, false)
    assert.equal(loaded.content[0]?.type, 'text')
    assert.match(loaded.content[0].text, /read[- ]only/i)
  })().catch(error => {
    console.error(error)
    process.exitCode = 1
  })`
  try {
    const result = spawnSync('pnpm', ['exec', 'tsx', '-e', script], {
      cwd: harnessRoot,
      encoding: 'utf8',
      env: { ...process.env, DSH_HOME: isolatedHome },
    })
    assert.equal(result.status, 0, result.stderr || result.stdout)
  } finally {
    rmSync(isolatedHome, { recursive: true, force: true })
  }
})

test('SOC skills are concise, scoped, and use bounded action parameters', () => {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  for (const name of [
    'splunk-investigation',
    'email-to-splunk-investigation',
    'false-positive-analysis',
  ]) {
    const content = readFileSync(join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8')
    assert.equal(content.includes('splunk_list_indexes'), false, name)
    assert.equal(content.includes('splunk_list_data_sources'), false, name)
    assert.match(content, /splunk_list_saved_searches\(name=/)
    assert.equal(content.split('\n').length < 140, true, `${name} should stay concise`)
  }
  const detection = readFileSync(join(repoRoot, 'skills', 'detection-engineering', 'SKILL.md'), 'utf8')
  assert.match(detection, /splunk_list_saved_searches\(name=/)
  assert.match(detection, /disabled draft/i)

  const triage = readFileSync(join(repoRoot, 'skills', 'soc-incident-triage', 'SKILL.md'), 'utf8')
  assert.match(triage, /Do not load every specialist skill up front/)
  assert.match(triage, /Stop conditions/)

  const splWriting = readFileSync(join(repoRoot, 'skills', 'spl-writing', 'SKILL.md'), 'utf8')
  assert.match(splWriting, /splunk_compile_citic_detection/)
  assert.match(splWriting, /backtest_spl/)
  assert.match(splWriting, /outputcsv/)
})

test('SOC web policy lists only existing upstream tests', () => {
  const harnessRoot = fileURLToPath(new URL('../../../vendor/deepseek-harness/', import.meta.url))
  assert.ok(SOC_UNSUPPORTED_WEB_TESTS.length > 0)
  for (const relativePath of SOC_UNSUPPORTED_WEB_TESTS) {
    assert.equal(existsSync(join(harnessRoot, relativePath)), true, relativePath)
  }
})
