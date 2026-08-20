import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'

type Task = {
  id: string
  name: string
  prompt: string
  rule: { kind: 'once'; at: string } | { kind: 'cron'; expression: string; timeZone: string }
  status: 'active' | 'paused' | 'completed'
  nextRunAt: string | null
  lastRunAt?: string
}

type Run = {
  id: string
  taskId: string
  scheduledFor: string
  state: 'queued' | 'running' | 'completed' | 'failed' | 'skipped_overlap'
  sessionId?: string
  errorCode?: string
}

type SchedulerSettings = { maxConcurrentRuns: number; runTimeoutMs: number }

const CHANNEL = '/splunk-zimbra-schedules'

async function rpc(connection: ConnectionHandle, endpoint: string, payload: Record<string, unknown> = {}) {
  const result = await connection.rpc.call(CHANNEL, endpoint, payload)
  if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${endpoint}`)
  return result.value
}

function localZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function readable(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—'
}

export function SchedulerSettings({ connection, openSession }: {
  connection: ConnectionHandle
  openSession: (id: string) => void
}) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettings>({ maxConcurrentRuns: 1, runTimeoutMs: 900000 })
  const [status, setStatus] = useState('Loading...')
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [kind, setKind] = useState<'once' | 'cron'>('once')
  const [at, setAt] = useState('')
  const [cron, setCron] = useState('0 * * * *')
  const [timeZone, setTimeZone] = useState(localZone)

  const load = useCallback(async () => {
    try {
      const value = await rpc(connection, 'list') as { tasks?: Task[]; runs?: Run[]; settings?: SchedulerSettings }
      setTasks(value.tasks ?? [])
      setRuns(value.runs ?? [])
      if (value.settings) setSchedulerSettings(value.settings)
      setStatus('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const mutate = async (endpoint: string, payload: Record<string, unknown>) => {
    setStatus('Saving...')
    try {
      await rpc(connection, endpoint, payload)
      await load()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    }
  }

  const create = async () => {
    const payload: Record<string, unknown> = { name, prompt }
    if (kind === 'once') {
      const [date, time] = at.split('T')
      payload.at = { date, time: time?.length === 5 ? `${time}:00` : time, time_zone: timeZone }
    } else {
      payload.cron = cron
      payload.time_zone = timeZone
    }
    await mutate('create', payload)
    setName('')
    setPrompt('')
    setAt('')
  }

  return React.createElement(
    'div',
    { className: css.form },
    React.createElement('p', { className: css.description }, 'Persistent read-only investigations run whenever this DSH host is active.'),
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
    React.createElement(
      'section', { className: css.section },
      React.createElement('h3', null, 'Scheduler limits'),
      React.createElement('div', { className: css.row },
        React.createElement('label', null, 'Concurrent runs'),
        React.createElement('input', { className: css.input, type: 'number', min: 1, max: 8, value: schedulerSettings.maxConcurrentRuns, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSchedulerSettings({ ...schedulerSettings, maxConcurrentRuns: Number(event.target.value) }) }),
      ),
      React.createElement('div', { className: css.row },
        React.createElement('label', null, 'Run timeout (seconds)'),
        React.createElement('input', { className: css.input, type: 'number', min: 1, max: 86400, value: schedulerSettings.runTimeoutMs / 1000, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSchedulerSettings({ ...schedulerSettings, runTimeoutMs: Number(event.target.value) * 1000 }) }),
      ),
      React.createElement('div', { className: css.actions }, React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => { void mutate('settings', schedulerSettings) } }, 'Save limits')),
    ),
    React.createElement(
      'section', { className: css.section },
      React.createElement('h3', null, 'Create task'),
      React.createElement('label', { className: css.fieldLabel }, 'Name'),
      React.createElement('input', { className: css.input, value: name, maxLength: 120, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value) }),
      React.createElement('label', { className: css.fieldLabel }, 'Investigation prompt'),
      React.createElement('textarea', { className: css.textarea, value: prompt, maxLength: 20000, rows: 5, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value) }),
      React.createElement('div', { className: css.row },
        React.createElement('label', null, 'Rule'),
        React.createElement('select', { className: css.input, value: kind, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setKind(event.target.value as 'once' | 'cron') },
          React.createElement('option', { value: 'once' }, 'One time'),
          React.createElement('option', { value: 'cron' }, 'Cron'),
        ),
      ),
      kind === 'once'
        ? React.createElement('div', { className: css.row }, React.createElement('label', null, 'Local time'), React.createElement('input', { className: css.input, type: 'datetime-local', step: 1, value: at, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setAt(event.target.value) }))
        : React.createElement('div', { className: css.row }, React.createElement('label', null, '5-field cron'), React.createElement('input', { className: css.input, value: cron, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setCron(event.target.value) })),
      React.createElement('div', { className: css.row }, React.createElement('label', null, 'Time zone'), React.createElement('input', { className: css.input, value: timeZone, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTimeZone(event.target.value) })),
      React.createElement('div', { className: css.actions }, React.createElement('button', { className: css.primaryButton, type: 'button', disabled: !name.trim() || !prompt.trim() || (kind === 'once' && !at), onClick: () => { void create() } }, 'Create task')),
    ),
    React.createElement(
      'section', { className: css.section },
      React.createElement('h3', null, 'Tasks'),
      tasks.length === 0 ? React.createElement('p', { className: css.description }, 'No scheduled tasks.') : null,
      tasks.map(task => React.createElement(
        'article', { className: css.account, key: task.id },
        React.createElement('strong', null, task.name),
        React.createElement('span', { className: css.description }, `${task.status} · Next ${readable(task.nextRunAt)} · Last ${readable(task.lastRunAt)}`),
        React.createElement('code', { className: css.rule }, task.rule.kind === 'once' ? task.rule.at : `${task.rule.expression} (${task.rule.timeZone})`),
        React.createElement('div', { className: css.actions },
          task.status === 'active' ? React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void mutate('pause', { id: task.id }) } }, 'Pause') : null,
          task.status === 'paused' ? React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void mutate('resume', { id: task.id }) } }, 'Resume') : null,
          React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void mutate('run-now', { id: task.id }) } }, 'Run now'),
          React.createElement('button', { className: css.deleteButton, type: 'button', onClick: () => { void mutate('delete', { id: task.id }) } }, 'Delete'),
        ),
      )),
    ),
    React.createElement(
      'section', { className: css.section },
      React.createElement('h3', null, 'Recent runs'),
      runs.length === 0 ? React.createElement('p', { className: css.description }, 'No runs yet.') : null,
      runs.map(run => React.createElement('div', { className: css.run, key: run.id },
        React.createElement('span', null, `${readable(run.scheduledFor)} · ${run.state}${run.errorCode ? ` · ${run.errorCode}` : ''}`),
        run.sessionId ? React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => openSession(run.sessionId!) }, 'Open investigation') : null,
      )),
    ),
  )
}

export const ScheduledTasksForm = SchedulerSettings
