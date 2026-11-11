import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, DOCUMENT_ATTACHMENTS_NAMESPACE } from '../src/index.ts'

test('saved upload preferences migrate once and obsolete text limits are retired', async () => {
  const legacy = 'soc-agent-markitdown-attachments'
  const sections = new Map<string, Record<string, unknown>>([[legacy, {
    maxFiles: 3, maxBytesPerFile: 1234, maxTotalBytes: 4321,
    maxCharsPerFile: 2000, maxTotalChars: 4000,
  }]])
  let initialized: Promise<unknown> | undefined
  const settings = {
    register(ns: string) {
      return {
        async update(value: Record<string, unknown>) { sections.set(ns, { ...sections.get(ns), ...value }) },
        async replace(value: Record<string, unknown>) { sections.set(ns, value) },
      }
    },
    describe: () => [...sections].map(([ns, user]) => ({ ns, user })),
  }
  const context = { inject(_services: unknown, callback: (ctx: unknown) => Promise<void>) {
    initialized = callback({ settings })
  } }
  apply(context as never)
  await initialized
  assert.deepEqual(sections.get(DOCUMENT_ATTACHMENTS_NAMESPACE), { maxFiles: 3, maxBytesPerFile: 1234, maxTotalBytes: 4321 })
  assert.deepEqual(sections.get(legacy), {})
  sections.set(DOCUMENT_ATTACHMENTS_NAMESPACE, { maxFiles: 2 })
  apply(context as never)
  await initialized
  assert.deepEqual(sections.get(DOCUMENT_ATTACHMENTS_NAMESPACE), { maxFiles: 2 })
})
