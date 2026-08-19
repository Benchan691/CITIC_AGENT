import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('Harness patch enables only the filesystem skill layer', () => {
  const productRoot = fileURLToPath(new URL('..', import.meta.url))
  const patch = readFileSync(join(productRoot, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- id: skill\n  disabled: false/)
  assert.match(patch, /- id: skill-filesystem\n  disabled: false[\s\S]*customSkillDirs:[\s\S]*MCP_SEVER_ROOT/)
  assert.match(patch, /- id: tool-skill\n  disabled: false/)
  assert.match(patch, /- id: skill-badge\n  disabled: true/)
  assert.match(patch, /- id: ui-skill\n  disabled: true/)
})

test('Harness discovers and loads the repository SOC skills through the skill tool', () => {
  const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
  const harnessRoot = fileURLToPath(new URL('../../deepseek-harness/', import.meta.url))
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
      'email-to-splunk-investigation',
      'splunk-investigation',
      'detection-engineering',
      'false-positive-analysis',
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
    assert.match(loaded.content[0].text, /read-only/i)
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
