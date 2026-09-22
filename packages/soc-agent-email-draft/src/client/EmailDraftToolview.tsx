import type { Context } from '@deepseek-ai/cordis'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { ClientContext, ToolCallBlock } from '@deepseek-ai/dsh-client-runtime/client'
import type { SocClientRuntime } from 'dsh-soc-agent-client/client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import css from './EmailDraftToolview.module.css'
import {
  draftFromForm,
  fileToEmailAttachment,
  validateEmailAttachmentSelection,
  ZIMBRA_DRAFT_TOOL_NAME,
  ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME,
  type EmailDraftAction,
  type EmailDraftFields,
  type EmailDraftFormFields,
} from './emailDraft.ts'
import { escapeHtml, renderEmailPreviewDocument, sanitizeEmailHtml } from './htmlEmail.ts'

export {
  EMAIL_ATTACHMENT_LIMITS,
  draftFromForm,
  fileToEmailAttachment,
  parseRecipientText,
  validateEmailAttachmentSelection,
  ZIMBRA_DRAFT_TOOL_NAME,
  ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME,
} from './emailDraft.ts'
export type {
  EmailAttachmentPayload,
  EmailDraftAction,
  EmailDraftFields,
  EmailDraftFormFields,
  EmailDraftMetadata,
} from './emailDraft.ts'

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

interface SelectedAttachment {
  id: string
  file: File
}

let attachmentId = 0

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

function actionFromEnvelope(value: unknown): EmailDraftAction {
  return value === 'reply' || value === 'forward' ? value : 'send'
}

function errorMessage(envelope: DraftEnvelope | null): string | null {
  const error = envelope?.error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return typeof error === 'string' && error ? error : null
}

function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function signatureAsHtml(signature: Signature): string {
  const value = signature.html?.trim()
    ? signature.html
    : escapeHtml(signature.text || '').replace(/\r?\n/gu, '<br>')
  return sanitizeEmailHtml(value)
}

interface EmailDraftProps extends ToolCallViewProps {
  socClient: SocClientRuntime
}

export function EmailDraftToolview({ block, socClient }: EmailDraftProps) {
  const envelope = useMemo(() => parseEnvelope(block), [block])
  const sourceKey = useMemo(() => JSON.stringify(envelope?.draft ?? null), [envelope])
  const action = actionFromEnvelope(envelope?.draft.action)
  const [fields, setFields] = useState<EmailDraftFormFields>(() => envelope ? formFromEnvelope(envelope) : {
    to: '', cc: '', bcc: '', subject: '', body: '',
  })
  const [status, setStatus] = useState<'editing' | 'sending' | 'sent' | 'failed' | 'discarded'>('editing')
  const [sendError, setSendError] = useState<string | null>(null)
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [signaturePanel, setSignaturePanel] = useState(false)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [signatureId, setSignatureId] = useState('')
  const [signaturePlacement, setSignaturePlacement] = useState<'above' | 'below'>('below')
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (envelope?.draft) {
      setFields(formFromEnvelope(envelope))
      setStatus('editing')
      setSendError(null)
      setSelectedAttachments([])
      setAttachmentError(null)
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

  const reopen = () => {
    setFields(envelope ? formFromEnvelope(envelope) : fields)
    setSelectedAttachments([])
    setAttachmentError(null)
    setSendError(null)
    setStatus('editing')
  }

  if (status === 'discarded') {
    return (
      <div className={css.card} data-dshcf-preserve="true">
        <div className={css.header}><span className={css.title}>Email draft discarded</span></div>
        <div className={css.actions}>
          <button className={css.button} type="button" onClick={reopen}>Reopen</button>
        </div>
      </div>
    )
  }

  const update = (field: keyof EmailDraftFormFields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields(current => ({ ...current, [field]: event.target.value }))
  }

  const chooseAttachments = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    const validation = validateEmailAttachmentSelection(files, selectedAttachments.map(item => item.file))
    if (validation) {
      setAttachmentError(validation)
    } else {
      setSelectedAttachments(current => [
        ...current,
        ...files.map(file => ({ id: `${Date.now()}-${attachmentId++}`, file })),
      ])
      setAttachmentError(null)
    }
    event.currentTarget.value = ''
  }

  const removeAttachment = (id: string) => {
    setSelectedAttachments(current => current.filter(item => item.id !== id))
    setAttachmentError(null)
  }

  const sourceMessageId = envelope?.draft.source_message_id
  const sourceMessage = envelope?.draft.source_message
  const replyAll = envelope?.draft.reply_all === true

  const submit = async () => {
    const safeBody = sanitizeEmailHtml(fields.body)
    const draft = draftFromForm({ ...fields, body: safeBody }, {
      action,
      body_format: 'html',
      ...(sourceMessageId === undefined ? {} : { source_message_id: sourceMessageId }),
      ...(action === 'reply' ? { reply_all: replyAll } : {}),
    })
    if (action !== 'reply' && draft.to.length === 0) {
      setSendError('Add at least one To recipient.')
      return
    }
    if (action === 'send' && !draft.subject) {
      setSendError('Subject cannot be empty.')
      return
    }
    const confirmation = action === 'reply'
      ? 'Reply to this email now?'
      : action === 'forward'
        ? 'Forward this email with the original message and all its attachments plus selected attachments now?'
        : 'Send this email now?'
    if (typeof window !== 'undefined' && !window.confirm(confirmation)) return
    setStatus('sending')
    setSendError(null)
    try {
      const attachments = await Promise.all(selectedAttachments.map(item => fileToEmailAttachment(item.file)))
      const result = await socClient.rpc<{ sent?: unknown }>('send-email', {
        ...draft,
        body_format: 'html',
        attachments,
      })
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
      const result = await socClient.rpc<{ signatures?: Signature[] }>('list-signatures')
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
    const value = signature ? signatureAsHtml(signature) : ''
    if (!value) {
      setSignatureStatus('The selected signature has no HTML content.')
      return
    }
    setFields(current => ({
      ...current,
      body: signaturePlacement === 'above' && current.body
        ? `${value}<br><br>${current.body}`
        : current.body
          ? `${current.body}<br><br>${value}`
          : value,
    }))
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
          <div className={css.title}>{action === 'reply' ? 'Reply to email' : action === 'forward' ? 'Forward email' : 'Email draft'}</div>
          <div className={css.account}>HTML draft · Send remains pending until confirmation</div>
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
        <div className={css.editorGrid}>
          <label className={css.field}>
            <span className={css.label}>{action === 'send' ? 'HTML body source' : 'Your HTML message (optional)'}</span>
            <textarea className={css.textarea} aria-label="Body" value={fields.body} onChange={update('body')} maxLength={18_000} />
          </label>
          <div className={css.previewPanel}>
            <div className={css.label}>Rendered preview</div>
            <iframe
              className={css.preview}
              title="Rendered HTML preview"
              sandbox=""
              srcDoc={renderEmailPreviewDocument(fields.body)}
            />
          </div>
        </div>
        {action !== 'send' && (
          <div className={css.field}>
            <div className={css.label}>{action === 'forward'
              ? 'The original message and all source attachments will be included; selected files will be added.'
              : 'The original message will be quoted in the reply; its source attachments will not be reattached.'}</div>
            <details>
              <summary>{sourceMessage?.subject || 'Original message'}</summary>
              <div>{sourceMessage?.from} {sourceMessage?.date}</div>
              <textarea className={css.textarea} aria-label="Original message preview" value={sourceMessage?.body || ''} readOnly />
              {sourceMessage?.body_truncated && <div>Preview shortened; the full original message will be included.</div>}
            </details>
            {sourceMessage?.attachments?.map(attachment => (
              <div key={attachment.part}>{attachment.filename || 'Unnamed attachment'}</div>
            ))}
          </div>
        )}
        <div className={css.attachmentPanel}>
          <div className={css.label}>Selected attachments</div>
          <input
            ref={attachmentInput}
            className={css.hiddenInput}
            aria-label="Attach files"
            type="file"
            multiple
            onChange={chooseAttachments}
          />
          <button className={css.button} type="button" disabled={status === 'sending'} onClick={() => attachmentInput.current?.click()}>
            Attach files
          </button>
          <div className={css.attachmentList}>
            {selectedAttachments.map(item => (
              <div className={css.attachmentItem} key={item.id}>
                <span>{item.file.name} · {formatBytes(item.file.size)}</span>
                <button
                  className={css.removeButton}
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  disabled={status === 'sending'}
                  onClick={() => removeAttachment(item.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className={css.help}>Up to 5 files, 10 MB per file, 50 MB total. Files are attached only after Send confirmation.</div>
          {attachmentError && <div className={`${css.message} ${css.error}`} role="alert">{attachmentError}</div>}
        </div>
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
          <button className={`${css.button} ${css.danger}`} type="button" disabled={status === 'sending'} onClick={() => setStatus('discarded')}>Discard</button>
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
  inject: ['slots', 'socClient'],
  apply(ctx: Context): void {
    const socClient = ctx.get('socClient') as SocClientRuntime
    for (const key of [ZIMBRA_DRAFT_TOOL_NAME, ZIMBRA_SIGNATURE_DRAFT_TOOL_NAME]) {
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key,
        inject: () => ({ socClient }),
      }, EmailDraftToolview))
    }
  },
}

export function installEmailDraftToolview(ctx: ClientContext): void {
  ctx.plugin(emailDraftToolview)
}
