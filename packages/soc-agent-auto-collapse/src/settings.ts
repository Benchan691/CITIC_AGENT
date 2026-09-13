import z from '@deepseek-ai/schemastery'

export const SOC_AUTO_COLLAPSE_NAMESPACE = 'dsh-auto-collapse'

export interface SocAutoCollapseSettings {
  enabled: boolean
  statusText: string
}

export const SocAutoCollapseSettingsSchema: z<SocAutoCollapseSettings> = z.object({
  enabled: z.boolean().default(true),
  statusText: z.string().default('Deep diving...'),
})
