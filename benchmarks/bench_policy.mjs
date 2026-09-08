// Headless equivalent of the SOC host's tool policy, without web/auth services.
import { APPROVAL_TOOLS, DOMAIN_TOOLS } from '../apps/soc-agent/policy.js'

export const name = 'citic-benchmark-policy'
export const inject = ['tools', 'approval']
const controls = new Set(['skill', 'ask_user_question', 'exit_plan_mode'])

export function apply(ctx, config) {
  const allowed = new Set(config.allowedTools.map(name => `mcp__soc_agent__${name}`))
  const simulatedDrafts = new Set(config.syntheticDrafts.map(name => `mcp__soc_agent__${name}`))
  const pending = new Set()
  ctx.on('tools/pre-execute', (exec, next) => {
    if (!controls.has(exec.name) && (!DOMAIN_TOOLS.has(exec.name) || !allowed.has(exec.name))) {
      return Promise.resolve({ kind: 'deny', reason: 'This case authorizes only its scoped SOC tools.' })
    }
    if (APPROVAL_TOOLS.has(exec.name)) {
      if (exec.callId && simulatedDrafts.has(exec.name)) pending.add(`${exec.callId}:${exec.name}`)
      return Promise.resolve({ kind: 'ask', reason: 'Approve this individual draft preparation; Save and publication remain separate.' })
    }
    return next()
  }, { global: true })
  // Synthetic cases have a scripted operator, not a remembered permission.
  // Consume one matching approval request once; lab requests fall through to
  // the real harness answerers. No persistent or remote action is simulated.
  ctx.on('approval/request', (req, next) => {
    const key = `${req.callId}:${req.toolName}`
    if (req.callId && pending.delete(key)) return Promise.resolve('allowed-once')
    return next()
  }, { global: true })
}
