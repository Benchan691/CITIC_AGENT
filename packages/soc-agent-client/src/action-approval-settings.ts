import z from '@deepseek-ai/schemastery'

export const SOC_ACTION_APPROVAL_NAMESPACE = 'soc-action-approval'

export interface SocActionApprovalSettings {
  autoApproveActions: string[]
}

export const SocActionApprovalSettingsSchema: z<SocActionApprovalSettings> = z.object({
  // An empty list is the fail-closed default: every catalog action asks.
  autoApproveActions: z.array(z.string()).default([]),
})
