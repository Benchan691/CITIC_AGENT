import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SplunkZimbraForm } from './SplunkZimbraForm.ts'
import { ScheduledTasksForm } from './ScheduledTasksForm.ts'
import { SETTINGS_SECTIONS } from './sections.ts'

export const inject = ['slots', 'connection'] as const

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.slots.inject('settings.section', () => {
    const connections = ctx.slots.register({
      name: 'settings.section',
      ...SETTINGS_SECTIONS[0],
      inject: () => ({ connection }),
    }, SplunkZimbraForm)
    const schedules = ctx.slots.register({
      name: 'settings.section',
      ...SETTINGS_SECTIONS[1],
      inject: () => ({ connection, openSession: (id: string) => { ctx.sessions.open(id as never) } }),
    }, ScheduledTasksForm)
    return () => {
      schedules()
      connections()
    }
  })
}
