import z from '@deepseek-ai/schemastery'

export const SOC_ACTION_APPROVAL_NAMESPACE = 'soc-action-approval'

export type SocActionMode = 'soc' | 'full'
export type SocActionState = 'ask' | 'auto' | 'disabled'

export interface SocActionApprovalSettings {
  mode: SocActionMode
  actionStates: Record<string, SocActionState>
}

export const SocActionApprovalSettingsSchema: z<SocActionApprovalSettings> = z.object({
  mode: z.union(['soc', 'full'] as const).default('soc'),
  actionStates: z.dict(z.union(['ask', 'auto', 'disabled'] as const)).default({}),
})
