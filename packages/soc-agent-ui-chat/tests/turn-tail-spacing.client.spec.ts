/** CSS checks for the completed-turn footer's 20px content spacing. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (name: string): string =>
  readFileSync(resolve(process.cwd(), 'packages/soc-agent-ui-chat/src/client/chat', name), 'utf8')

describe('completed-turn spacing', () => {
  it('combines the flow and footer offsets around turn-tail content', () => {
    expect(read('ChatView.module.css')).toMatch(/margin-top:\s*var\(--dsh-chat-flow-gap, 16px\)/)
    const tail = read('TurnTailNodeView.module.css')
    expect(tail).toMatch(/\.root\s*\{[^}]*gap:\s*16px/s)
    expect(tail).toMatch(/\.actions\s*\{[^}]*margin-top:\s*4px/s)
  })
})
