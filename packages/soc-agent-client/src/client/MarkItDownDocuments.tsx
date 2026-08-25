import { useSyncExternalStore } from 'react'
import type { ComposerDocumentsProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ComposerDocument } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { MarkItDownDocumentController } from './markitdownAttachments.ts'
import css from './MarkItDownDocuments.module.css'

function statusText(document: ComposerDocument, converting: boolean): string {
  if (document.status === 'failed') return document.error ?? 'Conversion failed'
  if (converting || document.status === 'converting') return 'Converting…'
  if (document.status === 'converted') return 'Ready'
  return 'Queued'
}

export function MarkItDownDocuments(props: ComposerDocumentsProps & { controller: MarkItDownDocumentController }) {
  const { controller, sessionId } = props
  useSyncExternalStore(controller.subscribe, controller.getVersion, controller.getVersion)
  const documents = controller.list(sessionId, props.documents.map(document => document.id))
  const pickerId = `soc-agent-file-picker-${sessionId}`
  if (documents.length === 0 && !props.canAcceptDocuments) return null
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
          if (files.length > 0 && props.canAcceptDocuments) props.onAddDocuments(files)
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
          <span className={css.status}>{statusText(document, props.phase === 'submitting')}</span>
          <button className={css.remove} type="button" aria-label={`Remove ${document.file.name}`} onClick={() => props.onRemoveDocument(document.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export function openMarkItDownPicker(sessionId: string): void {
  const input = document.getElementById(`soc-agent-file-picker-${sessionId}`)
  if (input instanceof HTMLInputElement) input.click()
}
