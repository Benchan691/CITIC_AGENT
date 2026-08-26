import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import React from 'react'
import { CiticBrandMark, CiticBrandName } from './CiticBrand.tsx'
import { SplunkSettings } from './SplunkSettings.ts'
import { SubscriptionServerSettings } from './SubscriptionServerSettings.ts'
import { SchedulerSettings } from './ScheduledTasksForm.ts'
import { SETTINGS_SECTIONS } from './sections.ts'
import { AuthGate } from './AuthGate.tsx'
import { installEmailDraftToolview } from './EmailDraftToolview.tsx'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx'
import { AttachmentSettingsController, MarkItDownAttachmentSettingsCard } from './MarkItDownAttachmentSettings.tsx'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'

export const inject = ['slots', 'connection', 'conversation', 'commandUi', 'settingsScope'] as const

export { SplunkSettings } from './SplunkSettings.ts'
export { SubscriptionServerSettings } from './SubscriptionServerSettings.ts'
export { SchedulerSettings } from './ScheduledTasksForm.ts'
export { EmailDraftToolview } from './EmailDraftToolview.tsx'

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  // SOC workspaces are the per-user filesystem workspaces guarded by the
  // server-side ownership proxy. Harness logical folders are process-global,
  // so keep that optional client surface disabled; WorkspaceRuntime then uses
  // workspace.* and sessions are created inside the owned workspace.
  const api = connection.api as { folders?: unknown }
  api.folders = undefined
  const documents = new MarkItDownDocumentController(
    connection,
    ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }),
  )
  const settings = new AttachmentSettingsController(
    ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }),
  )
  ctx.effect(
    () => ctx.conversation.registerDocumentProvider(documents),
    'soc-agent: MarkItDown document provider',
  )
  ctx.slots.inject('conversation.input.documents', () => ctx.slots.register({
    name: 'conversation.input.documents',
  }, props => React.createElement(MarkItDownDocuments, { ...props, controller: documents })))
  ctx.effect(
    () => ctx.commandUi.register({
      name: 'attach-file',
      description: 'Attach file',
      available: () => true,
      ui: {
        kind: 'action',
        options: async () => [],
        onSelect: (_option, session) => {
          openMarkItDownPicker(session.sessionId)
        },
      },
    }),
    'soc-agent: MarkItDown file command',
  )
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
    inject: () => settings.inject(),
  }, MarkItDownAttachmentSettingsCard))
  installEmailDraftToolview(ctx)
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'soc-agent-auth-gate',
    priority: -100,
  }, AuthGate))
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.inject('conversation.hero.brand.mark', function* () {
        yield ctx.slots.register({ name: 'sidebar.brand.mark', priority: -1 }, CiticBrandMark)
        yield ctx.slots.register({ name: 'sidebar.brand.name', priority: -1 }, CiticBrandName)
        yield ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -1 }, CiticBrandMark)
      })))
  ctx.slots.inject('settings.section', () => {
    const connections = ctx.slots.register({
      name: 'settings.section',
      ...SETTINGS_SECTIONS[0],
      inject: () => ({ connection }),
    }, () => React.createElement(React.Fragment, null,
      React.createElement(SplunkSettings, { connection }),
      React.createElement(SubscriptionServerSettings, { connection }),
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
