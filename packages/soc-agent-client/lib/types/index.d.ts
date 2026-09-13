/** Node half — registers the durable browser settings schema. */
import type { Context } from '@deepseek-ai/cordis';
export { SOC_ACTION_APPROVAL_NAMESPACE, SocActionApprovalSettingsSchema, } from './core/action-approval-settings.ts';
export type { SocActionApprovalSettings, SocActionMode, SocActionState, } from './core/action-approval-settings.ts';
export declare function apply(ctx: Context): void;
