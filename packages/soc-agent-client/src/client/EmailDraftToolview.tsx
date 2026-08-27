import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext, ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import React, { useEffect, useMemo, useState } from 'react'
import css from './EmailDraftToolview.module.css'
import { rpc } from './settings-common.ts'
import {
  draftFromForm,
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
  draft: Partial<EmailDraftFields>
  error?: unknown
}

interface Signature {
  id: string
  name: string
  text: string
  html: string
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
      return data as unknown as DraftEnvelope
    }
    if ('draft' in record) return record as unknown as DraftEnvelope
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
  return {
    to: listValue(draft.to).join(', '),
    cc: listValue(draft.cc).join(', '),
    bcc: listValue(draft.bcc).join(', '),
    subject: typeof draft.subject === 'string' ? draft.subject : '',
    body: typeof draft.body === 'string' ? draft.body : '',
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

interface EmailDraftProps extends ToolCallViewProps {
  connection: ConnectionHandle
}

export function EmailDraftToolview({ block, connection }: EmailDraftProps) {
  const envelope = useMemo(() => parseEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.draft ?? null), [envelope])
  const [fields, setFields] = useState<EmailDraftFormFields>(() => envelope ? formFromEnvelope(envelope) : {
    to: '', cc: '', bcc: '', subject: '', body: '',
  })
  const [status, setStatus] = useState<'editing' | 'sending' | 'sent' | 'failed' | 'discarded'>('editing')
  const [sendError, setSendError] = useState<string | null>(null)
  const [bodyFormat, setBodyFormat] = useState<'text' | 'html'>(envelope?.draft.body_format === 'html' ? 'html' : 'text')
  const [signaturePanel, setSignaturePanel] = useState(false)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [signatureId, setSignatureId] = useState('')
  const [signatureFormat, setSignatureFormat] = useState<'text' | 'html'>('text')
  const [signaturePlacement, setSignaturePlacement] = useState<'above' | 'below'>('below')
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null)

  useEffect(() => {
    if (envelope?.draft) {
      setFields(formFromEnvelope(envelope))
      setStatus('editing')
      setSendError(null)
      setBodyFormat(envelope.draft.body_format === 'html' ? 'html' : 'text')
      setSignaturePanel(false)
      setSignatureStatus(null)
    }
  }, [sourceKey])

  if (!('kind' in block)) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={css.message}>Preparing email draft…</div></div>
  }

  const upstreamError = errorMessage(envelope)
  if (upstreamError || block.isError) {
    return <div className={css.card} data-dshcf-preserve="true"><div className={`${css.message} ${css.error}`}>{upstreamError || 'Unable to create the email draft.'}</div></div>
  }

  if (status === 'discarded') {
    return (
      <div className={css.card} data-dshcf-preserve="true">
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

  const submit = async () => {
    const draft = draftFromForm(fields)
    if (draft.to.length === 0) {
      setSendError('Add at least one To recipient.')
      return
    }
    if (!draft.subject) {
      setSendError('Subject cannot be empty.')
      return
    }
    if (typeof window !== 'undefined' && !window.confirm('Send this email now?')) return
    setStatus('sending')
    setSendError(null)
    try {
      const result = await rpc(connection, 'send-email', {
        ...draft,
        body_format: bodyFormat,
      }) as { sent?: unknown }
      if (result?.sent !== true) throw new Error('Zimbra did not confirm that the email was sent.')
      setStatus('sent')
    } catch (error) {
      setStatus('failed')
      setSendError(error instanceof Error ? error.message : String(error))
    }
  }

  const loadSignatures = async () => {
    setSignaturePanel(true)
    setSignatureStatus('Loading signatures…')
    try {
      const result = await rpc(connection, 'list-signatures') as { signatures?: Signature[] }
      const next = result.signatures ?? []
      setSignatures(next)
      setSignatureId(current => current || next[0]?.id || '')
      setSignatureStatus(next.length ? null : 'No signatures are configured for this account.')
    } catch (error) {
      setSignatureStatus(error instanceof Error ? error.message : String(error))
    }
  }

  const applySignature = () => {
    const signature = signatures.find(item => item.id === signatureId)
    const value = signature?.[signatureFormat]
    if (!value) {
      setSignatureStatus(`The selected signature has no ${signatureFormat} content.`)
      return
    }
    const separator = signatureFormat === 'html' ? '<br><br>' : '\n\n'
    setFields(current => ({
      ...current,
      body: signaturePlacement === 'above' && current.body
        ? `${value}${separator}${current.body}`
        : current.body
          ? `${current.body}${separator}${value}`
          : value,
    }))
    setBodyFormat(signatureFormat)
    setSignaturePanel(false)
    setSignatureStatus(null)
  }

  if (status === 'sent') {
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><span className={css.title}>Email sent successfully</span></div>
      </div>
    )
  }

  return (
    <section className={css.card} data-dshcf-preserve="true" aria-label="Editable Zimbra email draft">
      <div className={css.header}>
        <div>
          <div className={css.title}>Email draft</div>
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
          {sendError && <div className={`${css.message} ${css.error}`} role="alert">{sendError}</div>}
          {signaturePanel && (
            <div className={css.signaturePanel}>
              <label className={css.field}>
                <span className={css.label}>Signature</span>
                <select className={css.input} aria-label="Signature" value={signatureId} onChange={event => setSignatureId(event.target.value)}>
                  {signatures.map(signature => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
                </select>
              </label>
              <label className={css.field}>
                <span className={css.label}>Format</span>
                <select className={css.input} aria-label="Signature format" value={signatureFormat} onChange={event => setSignatureFormat(event.target.value as 'text' | 'html')}>
                  <option value="text">Plain text</option>
                  <option value="html">HTML</option>
                </select>
              </label>
              <label className={css.field}>
                <span className={css.label}>Placement</span>
                <select className={css.input} aria-label="Signature placement" value={signaturePlacement} onChange={event => setSignaturePlacement(event.target.value as 'above' | 'below')}>
                  <option value="below">Below body</option>
                  <option value="above">Above body</option>
                </select>
              </label>
              {signatureStatus && <div className={css.message} role="status">{signatureStatus}</div>}
              <div className={css.actions}>
                <button className={css.button} type="button" onClick={() => setSignaturePanel(false)}>Cancel</button>
                <button className={`${css.button} ${css.primary}`} type="button" disabled={!signatureId || Boolean(signatureStatus)} onClick={applySignature}>Apply signature</button>
              </div>
            </div>
          )}
          <div className={css.actions}>
            <button className={`${css.button} ${css.danger}`} type="button" disabled={status === 'sending'} onClick={() => { setStatus('discarded') }}>Discard</button>
            <button className={`${css.button} ${css.signatureButton}`} type="button" disabled={status === 'sending'} onClick={() => { void loadSignatures() }}>Add signature</button>
            <button className={`${css.button} ${css.primary}`} type="button" disabled={status === 'sending'} onClick={submit}>
              {status === 'sending' ? 'Sending…' : status === 'failed' ? 'Retry' : 'Send'}
            </button>
          </div>
      </div>
    </section>
  )
}

export const emailDraftToolview = {
  name: 'zimbra-email-draft-toolview',
  inject: ['slots', 'connection'],
  apply(ctx: Context): void {
    const connection = ctx.get('connection') as ConnectionHandle
    for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
        inject: () => ({ connection }),
      }, EmailDraftToolview))
    }
  },
}

export function installEmailDraftToolview(ctx: ClientContext): void {
  ctx.plugin(emailDraftToolview)
}
