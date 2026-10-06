import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { reportPanelResult, PDF_MIME } from '../report-contract.ts'
import css from './Reports.module.css'

export function ReportArtifacts({ block }: ToolCallViewProps) {
  const result = reportPanelResult(block)
  return <section className={css.reportPanel} aria-label="Customer report files">
    <strong>Customer report</strong>
    {result.kind === 'working' && <p role="status">Preparing the Excel and PDF report…</p>}
    {result.kind === 'error' && <p className={css.error} role="alert">{result.message}</p>}
    {result.kind === 'success' && <>
      <p>Your report files are ready.</p>
      <div className={css.downloads}>{result.artifacts.map(artifact => <a key={artifact.id} className={css.download} href={artifact.download_url} download={artifact.filename}>
        <span>{artifact.mime_type === PDF_MIME ? 'Download PDF' : 'Download Excel'}</span>
        <small>{artifact.filename} · {(artifact.size_bytes / 1024).toFixed(0)} KB</small>
      </a>)}</div>
    </>}
  </section>
}
