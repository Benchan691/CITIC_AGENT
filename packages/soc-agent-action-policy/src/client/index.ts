import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from 'dsh-soc-agent-ui-conversation/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React from 'react'
import { SocActionPolicyMenu } from './SocActionPolicyMenu.tsx'

export { SocActionPolicyMenu } from './SocActionPolicyMenu.tsx'
export { readActionMode } from './actionPolicy.ts'

/** Optional end-user access-mode chooser. */
export const inject = ['slots', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  const socClient = ctx.get('socClient') as SocClientRuntime
  if (socClient.surface !== 'workspace') return
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'soc-action-policy',
    priority: -10,
  }, props => React.createElement(SocActionPolicyMenu, { ...props, socClient })))
}
