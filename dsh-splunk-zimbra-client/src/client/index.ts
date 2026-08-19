import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import React from 'react'
import { SplunkSettings } from './SplunkSettings.ts'
import { ZimbraSettings } from './ZimbraSettings.ts'
import { SchedulerSettings } from './ScheduledTasksForm.ts'
import { SETTINGS_SECTIONS } from './sections.ts'

export const inject = ['slots', 'connection'] as const

export { SplunkSettings } from './SplunkSettings.ts'
export { ZimbraSettings } from './ZimbraSettings.ts'
export { SchedulerSettings } from './ScheduledTasksForm.ts'

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.slots.inject('settings.section', () => {
    const connections = ctx.slots.register({
      name: 'settings.section',
      ...SETTINGS_SECTIONS[0],
      inject: () => ({ connection }),
    }, () => React.createElement(React.Fragment, null,
      React.createElement(SplunkSettings, { connection }),
      React.createElement(ZimbraSettings, { connection }),
    ))
    const schedules = ctx.slots.register({
      name: 'settings.section',
      ...SETTINGS_SECTIONS[1],
      inject: () => ({ connection, openSession: (id: string) => { ctx.sessions.open(id as never) } }),
    }, SchedulerSettings)
    return () => {
      schedules()
      connections()
    }
  })
}
