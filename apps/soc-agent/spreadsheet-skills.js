import { createUserMessage, HarnessError } from '@deepseek-ai/dsh-llm'
import { renderSkillContent } from '@deepseek-ai/dsh-skill'

export const name = 'soc-spreadsheet-skills'
export const inject = ['agents', 'tools', 'skills']

const SKILL_NAME = 'spreadsheet-mcp-analysis'
const PLUGIN_NAME = 'soc-spreadsheet-skills'
const EXCEL_TOOLS = new Set([
  'inspect', 'profile', 'count', 'aggregate', 'group', 'rows',
].map(operation => `mcp__soc_agent__excel_${operation}`))
const DEFERRED_NOTICE = JSON.stringify({
  status: 'deferred',
  operation_executed: false,
  skill: SKILL_NAME,
  message: 'Spreadsheet instructions are loaded for your next step. Reconsider the sheet, header, columns and row bounds, then issue the needed Excel call. This notice contains no spreadsheet data.',
})

function textOf(message) {
  return (message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
}

function isLinkedSkillResult(event, result, events) {
  return (event.sourceEventSeqs ?? []).some(seq => {
    const call = events[seq]
    if (call?.type !== 'tool/call' || call.data.name !== 'skill'
      || call.data.callId !== result.toolCallId) return false
    try { return JSON.parse(call.data.arguments).name === SKILL_NAME }
    catch { return false }
  })
}

// Only host instructions or a successful, linked skill-tool result can prove
// loading. Attachment text and user/model claims cannot satisfy this check.
function hasVisibleSkill(agent, nodes, rendered) {
  const events = agent.session.events
  const visible = new Set(agent.session.surface.nodes)
  for (const seq of nodes) {
    if (!visible.has(seq)) continue
    const event = events[seq]
    if (event?.type === 'user/message') {
      const source = event.data.source
      const trusted = (source?.kind === 'plugin' && source.plugin === PLUGIN_NAME)
        || (source?.kind === 'skill-invocation' && source.name === SKILL_NAME)
      if (trusted && textOf(event.data).includes(rendered)) return true
    } else if (event?.type === 'tool/result') {
      for (const result of event.data.message.content) {
        if (result.type === 'tool-result' && result.isError === false
          && isLinkedSkillResult(event, result, events) && textOf(result).includes(rendered)) return true
      }
    }
  }
  return false
}

function unavailable() {
  return new HarnessError(
    'Spreadsheet guidance is unavailable. Restore the spreadsheet-mcp-analysis skill in the configured skills folder before using Excel tools; report this problem instead of repeating the call.',
    'SPREADSHEET_SKILL_UNAVAILABLE',
  )
}

export function apply(ctx) {
  // A request snapshot proves the model saw the instructions before choosing
  // arguments. A skill loaded by a sibling call in the same batch is too late.
  const requests = new WeakMap()
  ctx.on('agent/request', async ({ agent, signal }, next) => {
    const request = await next()
    signal.throwIfAborted()
    requests.set(agent, { nodes: [...agent.session.surface.nodes], contextQueued: false })
    return request
  })

  ctx.on('tools/execute', async (exec, next) => {
    if (!EXCEL_TOOLS.has(exec.name)) return next()
    const { agent, signal } = exec
    signal.throwIfAborted()
    if (!agent) throw unavailable()
    let request = requests.get(agent)
    if (!request) {
      request = { nodes: [], contextQueued: false }
      requests.set(agent, request)
    }
    request.skill ??= ctx.skills.get(SKILL_NAME, {
      cwd: agent.session.header.cwd, scope: agent, signal,
    })
    const skill = await request.skill
    signal.throwIfAborted()
    if (!skill || !skill.invocation.modelInvocable) throw unavailable()
    const rendered = renderSkillContent(skill)
    if (hasVisibleSkill(agent, request.nodes, rendered)) return next()

    let additionalContexts
    if (!request.contextQueued && !hasVisibleSkill(agent, agent.session.surface.nodes, rendered)) {
      request.contextQueued = true
      additionalContexts = [createUserMessage({
        content: [{ type: 'text', text: [
          '<system-reminder>',
          'The spreadsheet skill below is now loaded. The deferred Excel calls were not executed. Follow these instructions and reconsider their arguments before continuing; do not call the skill tool again for this skill.',
          '</system-reminder>',
          rendered,
        ].join('\n') }],
        source: { kind: 'plugin', plugin: PLUGIN_NAME, form: 'instructions' },
      })]
    }
    // Keep the MCP bridge's canonical content contract. This is an explicit
    // control-flow notice, never a fabricated sheet/analysis result. Normal
    // pre-execution authorization has already run before this wrapper.
    return {
      isError: false,
      value: { content: [{ type: 'text', text: DEFERRED_NOTICE }] },
      content: [{ type: 'text', text: DEFERRED_NOTICE }],
      ...(additionalContexts ? { additionalContexts } : {}),
    }
  }, { global: true })
}
