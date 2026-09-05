import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { Context } from '../../../vendor/deepseek-harness/vendor/cordis/lib/index.js'
import Loader from '../../../vendor/deepseek-harness/vendor/loader/lib/index.js'
import Include from '../../../vendor/deepseek-harness/vendor/include/lib/index.js'
import SystemPrompt from '../../../vendor/deepseek-harness/packages/core/system-prompt/lib/index.js'
import * as Memory from '../lib/index.js'
import { MemoryStore } from '../lib/store.js'

test('Loader assembles current-query memory once per turn and removes it on disposal', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'soc-memory-composition-'))
  const ctx = new Context()
  try {
    const store = new MemoryStore(join(directory, 'memory'))
    await store.seedSummary('## Operations\n\nKnown SOC procedures.', 8000)
    await store.appendRawEntry({ content: 'quartz gateway uses the proxy procedure', scope: 'global' })
    await store.appendRawEntry({ content: 'zircon mail uses the delivery procedure', scope: 'global' })
    const original = MemoryStore.prototype.readSummary
    const summaryReads = t.mock.method(MemoryStore.prototype, 'readSummary', function () { return original.call(this) })
    const configPath = join(directory, 'cordis.yml')
    await writeFile(configPath, [
      '- name: system-prompt', '- name: memory', '  config:',
      `    memoryDir: ${JSON.stringify(store.dir)}`, '    autoSummarize: false',
      '    seedFromAgentsMd: false', '    scopedMemory: false',
    ].join('\n'))
    ctx.baseUrl = pathToFileURL(directory).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier) {
        if (specifier === 'system-prompt') return SystemPrompt
        if (specifier === 'memory') return Memory
        throw new Error(`Unexpected plugin: ${specifier}`)
      },
    }
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await ctx.loader.await()
    const prompt = ctx.systemPrompt
    const agent = { session: { events: [{ type: 'user/message', data: { content: [{ type: 'text', text: 'previous unrelated request' }] } }] } }
    const claim = (text, turn) => ctx.emit('agent/inbox/claimed', { agent, turn, message: { content: [{ type: 'text', text }] } })
    const assemble = async () => (await prompt.assemble({ agent })).contexts.find(entry => entry.name === 'soc-memory')?.text
    claim('quartz', 1)
    const first = await assemble()
    assert.match(first, /quartz gateway/)
    assert.doesNotMatch(first, /zircon mail/)
    const reads = summaryReads.mock.callCount()
    assert.deepEqual(await Promise.all(Array.from({ length: 6 }, assemble)), Array(6).fill(first))
    assert.equal(summaryReads.mock.callCount(), reads)
    claim('zircon', 2)
    assert.match(await assemble(), /zircon mail/)
    assert.equal(summaryReads.mock.callCount(), reads + 1)
    await ctx.fiber.dispose()
    assert.equal(await assemble(), undefined)
    assert.equal(summaryReads.mock.callCount(), reads + 1)
  } finally {
    await ctx.fiber.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
