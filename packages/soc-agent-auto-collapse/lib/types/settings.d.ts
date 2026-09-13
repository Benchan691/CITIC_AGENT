import z from '@deepseek-ai/schemastery';
export declare const SOC_AUTO_COLLAPSE_NAMESPACE = "dsh-auto-collapse";
export interface SocAutoCollapseSettings {
    enabled: boolean;
    statusText: string;
}
export declare const SocAutoCollapseSettingsSchema: z<SocAutoCollapseSettings>;
