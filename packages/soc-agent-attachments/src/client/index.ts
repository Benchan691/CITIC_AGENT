import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React from 'react'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
import { AttachmentSettingsController, MarkItDownAttachmentSettingsCard } from './MarkItDownAttachmentSettings.tsx'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx'

export {
  AttachmentSettingsController,
  MarkItDownAttachmentSettingsCard,
} from './MarkItDownAttachmentSettings.tsx'
export { MarkItDownDocumentController } from './markitdownAttachments.ts'
export { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx'
export { DEFAULT_MARKITDOWN_ATTACHMENT_SETTINGS, MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
export type { MarkItDownAttachmentSettings } from '../attachment-constants.ts'

/** Optional MarkItDown attachment/document feature. */
export const inject = ['slots', 'connection', 'conversation', 'commandUi', 'settingsScope', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  const socClient = ctx.get('socClient') as SocClientRuntime
  if (socClient.surface !== 'workspace') return
  const connection = ctx.get('connection') as ConnectionHandle
  const documents = new MarkItDownDocumentController(
    connection,
    ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }),
  )
  const settings = new AttachmentSettingsController(
    ctx.settingsScope.bind({ namespace: MARKITDOWN_ATTACHMENTS_NAMESPACE }),
  )
  ctx.effect(() => {
    const disposeProvider = ctx.conversation.registerDocumentProvider(documents)
    return () => {
      disposeProvider()
      documents.dispose()
    }
  }, 'soc-agent-attachments: MarkItDown document provider')
  ctx.slots.inject('conversation.input.documents', () => ctx.slots.register({
    name: 'conversation.input.documents',
    locale: 'conversation',
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
    'soc-agent-attachments: file command',
  )
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
    inject: () => settings.inject(),
  }, MarkItDownAttachmentSettingsCard))
  ctx.effect(() => () => settings.dispose(), 'soc-agent-attachments: settings controller')
}
