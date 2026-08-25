import { useState } from 'react'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { MarkItDownAttachmentSettings } from '../attachment-constants.ts'
import css from './MarkItDownAttachmentSettings.module.css'

interface FieldState { text: string; overridden: boolean; invalid: boolean }
interface AttachmentSettingsState {
  available: boolean; writable: boolean; dirty: boolean; invalid: boolean; saving: boolean; failed: boolean
  maxFiles: FieldState; maxBytesPerFile: FieldState; maxTotalBytes: FieldState; maxCharsPerFile: FieldState; maxTotalChars: FieldState
}

export interface AttachmentSettingsFace {
  hooks: { attachmentSettings: SnapshotStore<AttachmentSettingsState> }
  edit(field: string, text: string): void
  resetField(field: string): void
  save(): void
  discard(): void
}

const FIELDS = ['maxFiles', 'maxBytesPerFile', 'maxTotalBytes', 'maxCharsPerFile', 'maxTotalChars'] as const

export class AttachmentSettingsController {
  private readonly drafts = new Map<string, string>()
  private readonly cleared = new Set<string>()
  private readonly store: SnapshotStore<AttachmentSettingsState>
  private saving = false
  private failed = false

  constructor(private readonly scope: SettingsScope<MarkItDownAttachmentSettings>) {
    this.store = createSnapshotStore(this.state())
    scope.subscribe(() => this.publish())
  }

  inject(): AttachmentSettingsFace {
    return {
      hooks: { attachmentSettings: this.store },
      edit: (field, text) => { if (FIELDS.includes(field as typeof FIELDS[number])) { this.drafts.set(field, text); this.cleared.delete(field); this.failed = false; this.publish() } },
      resetField: field => { this.drafts.delete(field); this.cleared.add(field); this.failed = false; this.publish() },
      save: () => { void this.save() },
      discard: () => { this.drafts.clear(); this.cleared.clear(); this.failed = false; this.publish() },
    }
  }

  private async save(): Promise<void> {
    if (this.saving || !this.state().writable || this.state().invalid) return
    this.saving = true
    this.publish()
    try {
      for (const field of FIELDS) {
        if (this.cleared.has(field)) await this.scope.unset(field)
        else if (this.drafts.has(field)) {
          const value = Number(this.drafts.get(field))
          if (!Number.isSafeInteger(value) || value < 1) throw new Error('invalid')
          await this.scope.set(field, value)
        }
      }
      this.drafts.clear()
      this.cleared.clear()
      this.failed = false
    } catch {
      this.failed = true
    } finally {
      this.saving = false
      this.publish()
    }
  }

  private state(): AttachmentSettingsState {
    const snapshot = this.scope.getSnapshot()
    const value = snapshot.value ?? {}
    const user = snapshot.user && typeof snapshot.user === 'object' ? snapshot.user as Record<string, unknown> : {}
    const field = (name: string): FieldState => {
      const raw = value[name as keyof typeof value]
      const text = this.drafts.get(name) ?? (this.cleared.has(name) ? '' : typeof raw === 'number' ? String(raw) : '')
      return { text, overridden: this.drafts.has(name) || this.cleared.has(name) || Object.prototype.hasOwnProperty.call(user, name), invalid: text !== '' && (!Number.isSafeInteger(Number(text)) || Number(text) < 1) }
    }
    const fields = Object.fromEntries(FIELDS.map(name => [name, field(name)])) as Record<typeof FIELDS[number], FieldState>
    return {
      available: snapshot.status !== 'unavailable', writable: snapshot.writable, dirty: this.drafts.size > 0 || this.cleared.size > 0,
      invalid: FIELDS.some(name => fields[name].invalid), saving: this.saving, failed: this.failed, ...fields,
    }
  }

  private publish(): void { this.store.set(this.state()) }
}

type CardProps = PropsRuntime<'settings.plugin.item'> & InjectFace<AttachmentSettingsFace>

function Field({ id, label, hint, state, disabled, edit, reset }: { id: string; label: string; hint: string; state: FieldState; disabled: boolean; edit: (value: string) => void; reset: () => void }) {
  return <div className={css.field}>
    <div className={css.fieldHead}>
      <label className={css.fieldLabel} htmlFor={id}>{label}</label>
      {state.overridden && <span className={css.badges}>
        <span className={css.badge}>Overridden</span>
        <button className={css.reset} type="button" disabled={disabled} onClick={reset}>Reset</button>
      </span>}
    </div>
    <input className={state.invalid ? `${css.input} ${css.inputInvalid}` : css.input} id={id} inputMode="numeric" value={state.text} disabled={disabled} aria-invalid={state.invalid || undefined} onChange={event => edit(event.target.value)} />
    <p className={state.invalid ? css.invalid : css.hint}>{state.invalid ? 'Enter a positive whole number.' : hint}</p>
  </div>
}

function Chevron({ open }: { open: boolean }) {
  return <svg className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor" />
  </svg>
}

export function MarkItDownAttachmentSettingsCard(props: CardProps) {
  const state = props.useAttachmentSettings(value => value)
  const [open, setOpen] = useState(false)
  if (!state.available) return null
  const disabled = !state.writable
  return <li className={`${css.card}${open ? ` ${css.cardOpen}` : ''}`}>
    <button className={css.header} type="button" aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} settings: MarkItDown attachments`} onClick={() => setOpen(value => !value)}>
      <span className={css.headText}>
        <span className={css.name}>MarkItDown attachments</span>
        <span className={css.description}>Upload files and send their readable text to the AI.</span>
      </span>
      <Chevron open={open} />
    </button>
    {open && <div className={css.body}>
      <Field id="markitdown-max-files" label="Maximum files per message" hint="Default: 5" state={state.maxFiles} disabled={disabled} edit={value => props.edit('maxFiles', value)} reset={() => props.resetField('maxFiles')} />
      <Field id="markitdown-max-file-bytes" label="Maximum bytes per file" hint="Default: 10 MB" state={state.maxBytesPerFile} disabled={disabled} edit={value => props.edit('maxBytesPerFile', value)} reset={() => props.resetField('maxBytesPerFile')} />
      <Field id="markitdown-max-total-bytes" label="Maximum total upload bytes" hint="Default: 50 MB" state={state.maxTotalBytes} disabled={disabled} edit={value => props.edit('maxTotalBytes', value)} reset={() => props.resetField('maxTotalBytes')} />
      <Field id="markitdown-max-file-chars" label="Maximum Markdown characters per file" hint="Default: 200,000" state={state.maxCharsPerFile} disabled={disabled} edit={value => props.edit('maxCharsPerFile', value)} reset={() => props.resetField('maxCharsPerFile')} />
      <Field id="markitdown-max-total-chars" label="Maximum total Markdown characters" hint="Default: 500,000" state={state.maxTotalChars} disabled={disabled} edit={value => props.edit('maxTotalChars', value)} reset={() => props.resetField('maxTotalChars')} />
      <div className={css.footer}>
        {state.failed && <p className={css.failed} role="status">Could not save these limits.</p>}
        <button className={css.discard} type="button" disabled={!state.dirty || state.saving} onClick={props.discard}>Discard</button>
        <button className={css.save} type="button" disabled={!state.dirty || state.invalid || state.saving} onClick={props.save}>{state.saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>}
  </li>
}
