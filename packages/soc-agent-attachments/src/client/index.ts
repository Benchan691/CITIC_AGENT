import type { ConnectionHandle } from 'dsh-soc-agent-connection/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from 'dsh-soc-agent-ui-commands/client'
import type {} from 'dsh-soc-agent-ui-conversation/client'
import type {} from 'dsh-soc-agent-ui-chat/client'
import type {} from 'dsh-soc-agent-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-trajectory/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React from 'react'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
import { AttachmentSettingsController, MarkItDownAttachmentSettingsCard } from './MarkItDownAttachmentSettings.tsx'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx'
import { ComposerAttachments } from './ComposerAttachments.tsx'
import { MessageImages } from './MessageImages.tsx'

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
  ctx.slots.inject('conversation.input.attachments', () => ctx.slots.register({
    name: 'conversation.input.attachments',
    locale: 'conversation',
  }, props => React.createElement(React.Fragment, null,
    React.createElement(ComposerAttachments, {
      ...props,
      attachments: props.attachments.filter(attachment => attachment.kind !== 'document'),
    }),
    React.createElement(MarkItDownDocuments, { ...props, controller: documents }),
  )))
  ctx.slots.inject('conversation.message.images', () => ctx.slots.register({
    name: 'conversation.message.images',
    locale: 'conversation',
  }, MessageImages))
  ctx.slots.inject('conversation.trajectory.images', () => ctx.slots.register({
    name: 'conversation.trajectory.images',
    locale: 'conversation',
  }, MessageImages))
  ctx.slots.inject('tool.call.images', () => ctx.slots.register({
    name: 'tool.call.images',
    locale: 'conversation',
  }, MessageImages))
  ctx.effect(
    () => ctx.commandUi.register({
      name: 'attach-file',
      description: () => 'Attach file',
      available: () => true,
      ui: {
        kind: 'action',
        run: (session) => {
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
