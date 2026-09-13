import { useSyncExternalStore } from 'react'
import type {
  ComposerAttachmentsProps, ComposerDocument,
} from 'dsh-soc-agent-ui-conversation/client'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import css from './MarkItDownDocuments.module.css'

function statusText(document: ComposerDocument, converting: boolean): string {
  if (document.status === 'failed') return document.error ?? 'Conversion failed'
  if (converting || document.status === 'converting') return 'Converting…'
  if (document.status === 'converted') return 'Ready'
  return 'Queued'
}

export function MarkItDownDocuments(props: ComposerAttachmentsProps & { controller: MarkItDownDocumentController }) {
  const { controller, sessionId } = props
  useSyncExternalStore(controller.subscribe, controller.getVersion, controller.getVersion)
  if (sessionId === undefined) return null
  const documents = controller.list(
    sessionId,
    props.attachments
      .filter((attachment): attachment is ComposerDocument => attachment.kind === 'document')
      .map(document => document.id),
  )
  const pickerId = `soc-agent-file-picker-${sessionId}`
  if (documents.length === 0 && !props.canAcceptDrop) return null
  return (
    <div className={css.rail} aria-label="Attached files">
      <input
        id={pickerId}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])]
          event.currentTarget.value = ''
          if (files.length > 0 && props.canAcceptDrop) props.onAddFiles(files)
        }}
      />
      {documents.map(document => (
        <div
          key={document.id}
          className={css.item}
          title={document.error}
        >
          <span className={css.icon} aria-hidden="true">📎</span>
          <span className={css.name}>{document.file.name}</span>
          <span className={css.status}>{statusText(document, document.status === 'converting')}</span>
          <button className={css.remove} type="button" aria-label={`Remove ${document.file.name}`} onClick={() => props.onRemoveAttachment(document.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export function openMarkItDownPicker(sessionId: string): void {
  const input = document.getElementById(`soc-agent-file-picker-${sessionId}`)
  if (input instanceof HTMLInputElement) input.click()
}
