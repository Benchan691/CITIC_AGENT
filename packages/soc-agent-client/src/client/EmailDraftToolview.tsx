import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext, ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import React, { useEffect, useMemo, useState } from 'react'
import css from './EmailDraftToolview.module.css'
import {
  ZIMBRA_DRAFT_TOOL_NAME,
  ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME,
  type EmailDraftFields,
  type EmailDraftFormFields,
} from './emailDraft.ts'

export {
  draftFromForm,
  parseRecipientText,
  ZIMBRA_DRAFT_TOOL_NAME,
  ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME,
} from './emailDraft.ts'
export type { EmailDraftFields, EmailDraftFormFields } from './emailDraft.ts'

interface DraftEnvelope {
  draft: Partial<EmailDraftFields> & {
    account?: { label?: unknown; email?: unknown }
  }
  error?: unknown
}

function resultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  return block.content
    .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
    .map(item => item.text)
    .join('')
}

function parseEnvelope(block: ToolCallBlock): DraftEnvelope | null {
  const text = resultText(block)
  if (!text) return null
  try {
    const value: unknown = JSON.parse(text)
    if (typeof value !== 'object' || value === null) return null
    const record = value as Record<string, unknown>
    const data = record.data
    if (typeof data === 'object' && data !== null && 'draft' in data) {
      return data as DraftEnvelope
    }
    if ('draft' in record) return record as DraftEnvelope
    return { draft: {}, error: record.error }
  } catch {
    return null
  }
}

function listValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string') as string[]
  if (typeof value === 'string') return value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean)
  return []
}

function formFromEnvelope(envelope: DraftEnvelope): EmailDraftFormFields {
  const draft = envelope.draft || {}
  const account = draft.account
  const accountLabel = [account?.label, account?.email]
    .filter((value): value is string => typeof value === 'string' && value !== '')
    .join(' · ')
  return {
    to: listValue(draft.to).join(', '),
    cc: listValue(draft.cc).join(', '),
    bcc: listValue(draft.bcc).join(', '),
    subject: typeof draft.subject === 'string' ? draft.subject : '',
    body: typeof draft.body === 'string' ? draft.body : '',
    accountId: typeof draft.account_id === 'string' ? draft.account_id : '',
    accountLabel,
  }
}

function errorMessage(envelope: DraftEnvelope | null): string | null {
  const error = envelope?.error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return typeof error === 'string' && error ? error : null
}

export function EmailDraftToolview({ block }: ToolCallViewProps) {
  const envelope = useMemo(() => parseEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.draft ?? null), [envelope])
  const [fields, setFields] = useState<EmailDraftFormFields>(() => envelope ? formFromEnvelope(envelope) : {
    to: '', cc: '', bcc: '', subject: '', body: '', accountId: '', accountLabel: '',
  })
  const [status, setStatus] = useState<'editing' | 'discarded'>('editing')

  useEffect(() => {
    if (envelope?.draft) setFields(formFromEnvelope(envelope))
  }, [sourceKey])

  if (!('kind' in block)) {
    return <div className={css.card}><div className={css.message}>Preparing email draft…</div></div>
  }

  const upstreamError = errorMessage(envelope)
  if (upstreamError || block.isError) {
    return <div className={css.card}><div className={`${css.message} ${css.error}`}>{upstreamError || 'Unable to create the email draft.'}</div></div>
  }

  if (status === 'discarded') {
    return (
      <div className={css.card}>
        <div className={css.header}><span className={css.title}>Email draft discarded</span></div>
        <div className={css.actions}>
          <button className={css.button} type="button" onClick={() => { setFields(envelope ? formFromEnvelope(envelope) : fields); setStatus('editing') }}>Reopen</button>
        </div>
      </div>
    )
  }

  const update = (field: keyof EmailDraftFormFields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields(current => ({ ...current, [field]: event.target.value }))
  }

  return (
    <section className={css.card} aria-label="Editable Zimbra email draft">
      <div className={css.header}>
        <div>
          <div className={css.title}>Email draft</div>
          {fields.accountLabel && <div className={css.account}>via {fields.accountLabel}</div>}
        </div>
      </div>
      <div className={css.content}>
          {(['to', 'cc', 'bcc'] as const).map(field => (
            <label className={css.field} key={field}>
              <span className={css.label}>{field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc'}</span>
              <input className={css.input} aria-label={field} value={fields[field]} onChange={update(field)} placeholder="name@example.com" />
            </label>
          ))}
          <label className={css.field}>
            <span className={css.label}>Subject</span>
            <input className={css.input} aria-label="Subject" value={fields.subject} onChange={update('subject')} maxLength={998} />
          </label>
          <label className={css.field}>
            <span className={css.label}>Body</span>
            <textarea className={css.textarea} aria-label="Body" value={fields.body} onChange={update('body')} maxLength={18_000} />
          </label>
          <div className={css.actions}>
            <button className={css.button} type="button" onClick={() => { setStatus('discarded') }}>Discard</button>
          </div>
      </div>
    </section>
  )
}

export const emailDraftToolview = {
  name: 'zimbra-email-draft-toolview',
  inject: ['slots'],
  apply(ctx: Context): void {
    for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
      }, EmailDraftToolview))
    }
  },
}

export function installEmailDraftToolview(ctx: ClientContext): void {
  ctx.plugin(emailDraftToolview)
}
