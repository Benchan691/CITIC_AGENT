import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React from 'react'
import { DOCUMENT_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
import { AttachmentSettingsController, DocumentAttachmentSettingsCard } from './DocumentAttachmentSettings.tsx'
import { DocumentAttachmentController } from './documentAttachments.ts'
import { Documents, openDocumentPicker } from './Documents.tsx'

export {
  AttachmentSettingsController,
  DocumentAttachmentSettingsCard,
} from './DocumentAttachmentSettings.tsx'
export { DocumentAttachmentController } from './documentAttachments.ts'
export { Documents, openDocumentPicker } from './Documents.tsx'
export { DEFAULT_DOCUMENT_ATTACHMENT_SETTINGS, DOCUMENT_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
export type { DocumentAttachmentSettings } from '../attachment-constants.ts'

/** Optional on-demand attachment/document feature. */
export const inject = ['slots', 'connection', 'conversation', 'commandUi', 'settingsScope', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  const socClient = ctx.get('socClient') as SocClientRuntime
  if (socClient.surface !== 'workspace') return
  const connection = ctx.get('connection') as ConnectionHandle
  const documents = new DocumentAttachmentController(
    connection,
    ctx.settingsScope.bind({ namespace: DOCUMENT_ATTACHMENTS_NAMESPACE }),
  )
  const settings = new AttachmentSettingsController(
    ctx.settingsScope.bind({ namespace: DOCUMENT_ATTACHMENTS_NAMESPACE }),
  )
  ctx.effect(() => {
    const disposeProvider = ctx.conversation.registerDocumentProvider(documents)
    return () => {
      disposeProvider()
      documents.dispose()
    }
  }, 'soc-agent-attachments: on-demand document provider')
  ctx.slots.inject('conversation.input.documents', () => ctx.slots.register({
    name: 'conversation.input.documents',
    locale: 'conversation',
  }, props => React.createElement(Documents, { ...props, controller: documents })))
  ctx.effect(
    () => ctx.commandUi.register({
      name: 'attach-file',
      description: 'Attach file',
      available: () => true,
      ui: {
        kind: 'action',
        options: async () => [],
        onSelect: (_option, session) => {
          openDocumentPicker(session.sessionId)
        },
      },
    }),
    'soc-agent-attachments: file command',
  )
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: DOCUMENT_ATTACHMENTS_NAMESPACE,
    inject: () => settings.inject(),
  }, DocumentAttachmentSettingsCard))
  ctx.effect(() => () => settings.dispose(), 'soc-agent-attachments: settings controller')
}
