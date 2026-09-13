import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import { installEmailDraftToolview } from './EmailDraftToolview.tsx'

export {
  EmailDraftToolview,
  emailDraftToolview,
  draftFromForm,
  parseRecipientText,
  ZIMBRA_DRAFT_TOOL_NAME,
  ZIMBRA_FORWARD_DRAFT_TOOL_NAME,
  ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME,
} from './EmailDraftToolview.tsx'
export type { EmailDraftFields, EmailDraftFormFields } from './EmailDraftToolview.tsx'

/** Optional editable email draft tool views. */
export const inject = ['slots', 'socClient'] as const

export function apply(ctx: ClientContext): void {
  if ((ctx.get('socClient') as SocClientRuntime).surface !== 'workspace') return
  installEmailDraftToolview(ctx)
}
