import z from '@deepseek-ai/schemastery'

export const SOC_AUTO_COLLAPSE_NAMESPACE = 'dsh-auto-collapse'

export interface SocAutoCollapseSettings {
  enabled: boolean
  statusText: string
}

export const SocAutoCollapseSettingsSchema: z<SocAutoCollapseSettings> = z.object({
  enabled: z.boolean().default(true),
  // Preserve the former plugin's default and persisted preference contract.
  // An explicitly empty value restores the host's localized rc.2 text.
  statusText: z.string().default('Deep sleeping...'),
})
