import type { Context } from '@deepseek-ai/cordis';
export { downloadReportArtifact, reportSettingsEndpoint, validateStoredArtifact } from './host.ts';
export { REPORT_CHANNEL, REPORT_TOOL_NAME } from './report-contract.ts';
export declare const inject: readonly ["socAuth", "connection", "webServer"];
export declare function apply(ctx: Context): void;
