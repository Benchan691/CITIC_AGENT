import z from '@deepseek-ai/schemastery';
export declare const SOC_ACTION_APPROVAL_NAMESPACE = "soc-action-approval";
export type SocActionMode = 'soc' | 'full';
export type SocActionState = 'ask' | 'auto' | 'disabled';
export interface SocActionApprovalSettings {
    mode: SocActionMode;
    actionStates: Record<string, SocActionState>;
}
export declare const SocActionApprovalSettingsSchema: z<SocActionApprovalSettings>;
