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
import { AdminConsole } from './AdminConsole.tsx'
import { AuthGate } from './AuthGate.tsx'
import { CatalogManager } from './CatalogManager.tsx'
import { installCatalogToolview } from './CatalogToolview.tsx'
import { installEmailDraftToolview } from './EmailDraftToolview.tsx'
import { installSplunkDetectionToolview } from './SplunkDetectionToolview.tsx'
import { installSplunkLookupToolview } from './SplunkLookupToolview.tsx'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import { MarkItDownDocuments, openMarkItDownPicker } from './MarkItDownDocuments.tsx'
import { AttachmentSettingsController, MarkItDownAttachmentSettingsCard } from './MarkItDownAttachmentSettings.tsx'
import { SocActionApprovalController, SocActionApprovalSettingsCard } from './SocActionApprovalSettings.tsx'
import { SocActionPolicyMenu } from './SocActionPolicyMenu.tsx'
import { MARKITDOWN_ATTACHMENTS_NAMESPACE } from '../attachment-constants.ts'
import { SOC_ACTION_APPROVAL_NAMESPACE } from '../action-approval-settings.ts'

export const inject = ['slots', 'connection', 'conversation', 'commandUi', 'settingsScope'] as const

export { SplunkSettings } from './SplunkSettings.ts'
export { SubscriptionServerSettings } from './SubscriptionServerSettings.ts'
export { AdminConsole } from './AdminConsole.tsx'
export { CatalogManager } from './CatalogManager.tsx'
export { EmailDraftToolview } from './EmailDraftToolview.tsx'
export { SplunkDetectionToolview } from './SplunkDetectionToolview.tsx'
export { CatalogToolview } from './CatalogToolview.tsx'
export { SplunkLookupToolview } from './SplunkLookupToolview.tsx'

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const path = typeof window === 'undefined' ? '' : window.location.pathname
  if (path === '/admin' || path.startsWith('/admin/')) {
    // The admin console shadows the shell's root entry at a lower priority.
    // No conversation, workspace, sidebar, or regular-auth UI is mounted in
    // this branch; the server still enforces the boundary for every request.
    ctx.slots.inject('root', () => ctx.slots.register({
      name: 'root',
      priority: -1,
    }, () => React.createElement(AdminConsole, { connection })))
    return
  }
  if (path === '/catalogs' || path.startsWith('/catalogs/')) {
    // The catalog management page mirrors the admin console pattern: it
    // replaces the conversation shell and authenticates on every RPC call.
    ctx.slots.inject('root', () => ctx.slots.register({
      name: 'root',
      priority: -1,
    }, () => React.createElement(CatalogManager, { connection })))
    return
  }
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
  const actionApproval = new SocActionApprovalController(
    connection,
    ctx.settingsScope.bind({ namespace: SOC_ACTION_APPROVAL_NAMESPACE }),
  )
  ctx.effect(
    () => ctx.conversation.registerDocumentProvider(documents),
    'soc-agent: MarkItDown document provider',
  )
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
    'soc-agent: MarkItDown file command',
  )
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: MARKITDOWN_ATTACHMENTS_NAMESPACE,
    inject: () => settings.inject(),
  }, MarkItDownAttachmentSettingsCard))
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: SOC_ACTION_APPROVAL_NAMESPACE,
    inject: () => actionApproval.inject(),
  }, SocActionApprovalSettingsCard))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'soc-action-policy',
    priority: -10,
  }, props => React.createElement(SocActionPolicyMenu, { ...props, connection })))
  installEmailDraftToolview(ctx)
  installSplunkDetectionToolview(ctx)
  installCatalogToolview(ctx)
  installSplunkLookupToolview(ctx)
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
}
