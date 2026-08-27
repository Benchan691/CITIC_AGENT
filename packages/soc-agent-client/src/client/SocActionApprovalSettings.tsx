import { useState } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { SettingsScope, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SocActionApprovalSettings } from '../action-approval-settings.ts'
import css from './SocActionApprovalSettings.module.css'

const CHANNEL = '/soc-agent-config'

export interface SocAction {
  name: string
  group: string
  label: string
}

export interface SocActionApprovalState {
  available: boolean
  writable: boolean
  dirty: boolean
  invalid: boolean
  saving: boolean
  failed: boolean
  catalogLoaded: boolean
  catalogFailed: boolean
  actions: readonly SocAction[]
  autoApproveActions: readonly string[]
}

export interface SocActionApprovalFace {
  hooks: { socActionApproval: SnapshotStore<SocActionApprovalState> }
  toggle(name: string, ask: boolean): void
  requireApprovalForAll(): void
  allowAllKnownActions(): void
  reset(): void
  save(): void
  discard(): void
}

export function validCatalog(value: unknown): SocAction[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Record<string, unknown>
    if (typeof candidate.name !== 'string' || typeof candidate.group !== 'string' || typeof candidate.label !== 'string') return []
    if (candidate.name.length === 0 || seen.has(candidate.name)) return []
    seen.add(candidate.name)
    return [{ name: candidate.name, group: candidate.group, label: candidate.label }]
  })
}

function namesOf(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((name): name is string => typeof name === 'string') : [])
}

export class SocActionApprovalController {
  private actions: readonly SocAction[] = []
  private catalogLoaded = false
  private catalogFailed = false
  private draft: Set<string> | undefined
  private resetOnSave = false
  private saving = false
  private failed = false
  private readonly store: SnapshotStore<SocActionApprovalState>

  constructor(
    private readonly connection: ConnectionHandle,
    private readonly scope: SettingsScope<SocActionApprovalSettings>,
  ) {
    this.store = createSnapshotStore(this.state())
    scope.subscribe(() => this.publish())
    void this.loadCatalog()
  }

  inject(): SocActionApprovalFace {
    return {
      hooks: { socActionApproval: this.store },
      toggle: (name, ask) => this.toggle(name, ask),
      requireApprovalForAll: () => this.stage(new Set(), true),
      allowAllKnownActions: () => this.stage(new Set(this.actions.map(action => action.name)), false),
      reset: () => this.stage(new Set(), true),
      save: () => { void this.save() },
      discard: () => {
        this.draft = undefined
        this.resetOnSave = false
        this.failed = false
        this.publish()
      },
    }
  }

  private async loadCatalog(): Promise<void> {
    try {
      const response = await this.connection.rpc.call(CHANNEL, 'get-action-catalog', {})
      if (!response?.ok) throw new Error('catalog')
      const actions = validCatalog((response.value as { actions?: unknown })?.actions)
      if (actions.length === 0) throw new Error('catalog')
      this.actions = actions
      this.catalogLoaded = true
    } catch {
      this.catalogFailed = true
    }
    this.publish()
  }

  private toggle(name: string, ask: boolean): void {
    if (!this.actions.some(action => action.name === name)) return
    const next = this.draft === undefined ? namesOf(this.scope.getSnapshot().value?.autoApproveActions) : new Set(this.draft)
    if (ask) next.delete(name)
    else next.add(name)
    this.stage(next, false)
  }

  private stage(actions: Set<string>, resetOnSave: boolean): void {
    this.draft = actions
    this.resetOnSave = resetOnSave
    this.failed = false
    this.publish()
  }

  private async save(): Promise<void> {
    const state = this.state()
    if (this.saving || !state.writable || !state.dirty || state.invalid) return
    this.saving = true
    this.publish()
    try {
      if (this.resetOnSave) await this.scope.unset('autoApproveActions')
      else await this.scope.set('autoApproveActions', [...(this.draft ?? new Set())])
      this.draft = undefined
      this.resetOnSave = false
      this.failed = false
    } catch {
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  private state(): SocActionApprovalState {
    const snapshot = this.scope.getSnapshot()
    const saved = namesOf(snapshot.value?.autoApproveActions)
    const autoApproveActions = this.draft === undefined ? saved : this.draft
    return {
      available: snapshot.status !== 'unavailable',
      writable: snapshot.writable,
      dirty: this.draft !== undefined,
      invalid: this.catalogFailed,
      saving: this.saving,
      failed: this.failed,
      catalogLoaded: this.catalogLoaded,
      catalogFailed: this.catalogFailed,
      actions: this.actions,
      autoApproveActions: [...autoApproveActions],
    }
  }

  private publish(): void { this.store.set(this.state()) }
}

type CardProps = PropsRuntime<'settings.plugin.item'> & InjectFace<SocActionApprovalFace>

function Chevron({ open }: { open: boolean }) {
  return <svg className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor" />
  </svg>
}

export function SocActionApprovalSettingsCard(props: CardProps) {
  const state = props.useSocActionApproval(value => value)
  const [open, setOpen] = useState(false)
  if (!state.available) return null
  const disabled = !state.writable || state.saving || !state.catalogLoaded
  const auto = new Set(state.autoApproveActions)
  const groups = [...new Set(state.actions.map(action => action.group))]
  return <li className={open ? `${css.card} ${css.cardOpen}` : css.card}>
    <button className={css.header} type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} settings: SOC action approvals`} onClick={() => setOpen(value => !value)}>
      <span className={css.headText}>
        <span className={css.name}>SOC action approvals</span>
        <span className={css.description}>Choose which SOC actions must ask before they run.</span>
      </span>
      <Chevron open={open} />
    </button>
    {open && <div className={css.body}>
      {!state.writable && <p className={css.status} role="status">This deployment stores settings read-only.</p>}
      {state.catalogFailed && <p className={css.failed} role="status">Could not load the SOC action catalog.</p>}
      {!state.catalogLoaded && !state.catalogFailed && <p className={css.status} role="status">Loading actions…</p>}
      {state.catalogLoaded && <>
        <p className={css.explanation}>Checked actions ask for approval. Unchecked actions run automatically, while all server-side safety checks still apply.</p>
        <div className={css.groups}>
          {groups.map(group => <fieldset className={css.group} key={group}>
            <legend className={css.groupTitle}>{group}</legend>
            {state.actions.filter(action => action.group === group).map(action => <label className={css.action} key={action.name}>
              <input className={css.checkbox} type="checkbox" checked={!auto.has(action.name)} disabled={disabled} onChange={event => props.toggle(action.name, event.currentTarget.checked)} />
              <span className={css.actionText}><span className={css.actionName}>{action.label}</span><span className={css.actionTool}>{action.name}</span></span>
            </label>)}
          </fieldset>)}
        </div>
        <div className={css.shortcuts}>
          <button className={css.shortcut} type="button" disabled={disabled} onClick={props.requireApprovalForAll}>Require approval for all</button>
          <button className={css.shortcut} type="button" disabled={disabled} onClick={props.allowAllKnownActions}>Allow all known actions</button>
          <button className={css.reset} type="button" disabled={disabled} onClick={props.reset}>Reset to default</button>
        </div>
      </>}
      <div className={css.footer}>
        {state.failed && <p className={css.failed} role="status">Could not save these approval settings.</p>}
        <button className={css.discard} type="button" disabled={!state.dirty || state.saving} onClick={props.discard}>Discard</button>
        <button className={css.save} type="button" disabled={!state.dirty || state.invalid || state.saving || !state.catalogLoaded} onClick={props.save}>{state.saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>}
  </li>
}
