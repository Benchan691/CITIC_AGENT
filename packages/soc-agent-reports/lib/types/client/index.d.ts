import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { ReportArtifacts } from './ReportArtifacts.tsx';
export { CustomerReportSettingsCard } from './ReportSettings.tsx';
export { reportPanelResult, validReportArtifact, validateCustomerProfiles } from '../report-contract.ts';
export declare const inject: readonly ["slots", "connection", "socClient"];
export declare function apply(ctx: ClientContext): void;
