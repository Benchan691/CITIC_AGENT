import type { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from 'dsh-soc-agent-client/client'
import {
  SOC_AUTO_COLLAPSE_NAMESPACE,
  type SocAutoCollapseSettings,
} from '../settings.ts'

export interface SocAutoCollapseSnapshot {
  readonly enabled: boolean
  readonly statusText: string
}

export interface SocAutoCollapseRuntime {
  readonly state: SnapshotStore<SocAutoCollapseSnapshot>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    socAutoCollapse: SocAutoCollapseRuntime
  }
}

export const inject = ['socClient', 'settingsScope']

export function apply(ctx: Context): void {
  const scope = ctx.settingsScope.bind<SocAutoCollapseSettings>({ namespace: SOC_AUTO_COLLAPSE_NAMESPACE })
  const state = createSnapshotStore<SocAutoCollapseSnapshot>({
    enabled: true,
    statusText: 'Deep diving...',
  })
  const adopt = (): void => {
    const settings = scope.getSnapshot().value
    if (settings === undefined) return
    state.set({ enabled: settings.enabled, statusText: settings.statusText })
  }
  adopt()
  const dispose = scope.subscribe(adopt)
  ctx.provide('socAutoCollapse', { state })
  ctx.effect(() => dispose, 'soc-auto-collapse: settings subscription')
}
