import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'
import { errorText, rpc, SettingRow, Settings, TestResult, TestStatus } from './settings-common.ts'

export function SplunkSettings({ connection }: { connection: ConnectionHandle }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState('Loading...')
  const [test, setTest] = useState<TestResult | null>(null)

  const load = useCallback(async () => {
    try {
      setSettings(await rpc(connection, 'get-settings') as Settings)
      setStatus('')
    } catch (error) { setStatus(errorText(error)) }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const update = (key: string, value: unknown) => {
    setSettings(current => ({ ...current!, splunk: { ...current!.splunk, [key]: value } }))
  }
  const save = async () => {
    try { setStatus('Saving...'); setSettings(await rpc(connection, 'update-settings', settings ?? {}) as Settings); setStatus('Saved') }
    catch (error) { setStatus(errorText(error)) }
  }
  const remove = async (key: string) => {
    try { setStatus('Deleting...'); setSettings(await rpc(connection, 'delete-setting', { key }) as Settings); setStatus('Deleted') }
    catch (error) { setStatus(errorText(error)) }
  }
  const testSplunk = async () => {
    setTest({ kind: 'pending', text: 'Testing…' })
    try {
      const value = await rpc(connection, 'test-splunk') as { index_count?: number }
      setTest({ kind: 'ok', text: `Splunk OK (${String(value.index_count ?? 0)} indexes)` })
    } catch (error) { setTest({ kind: 'fail', text: errorText(error) }) }
  }

  if (!settings) return React.createElement('div', { className: css.loading }, status)
  const splunk = settings.splunk
  return React.createElement('section', { className: css.section },
    React.createElement('h3', null, 'Splunk'),
    React.createElement(SettingRow, { label: 'URL', value: String(splunk.url || ''), onChange: value => update('url', value), onDelete: () => { void remove('splunk.url') } }),
    React.createElement(SettingRow, { label: 'Username', value: String(splunk.username || ''), onChange: value => update('username', value), onDelete: () => { void remove('splunk.username') } }),
    React.createElement(SettingRow, { label: 'Password', value: '', type: 'password', placeholder: splunk.has_password ? 'Stored password is set' : '', onChange: value => update('password', value), onDelete: () => { void remove('splunk.password') } }),
    React.createElement(SettingRow, { label: 'Verify SSL', value: String(splunk.verify_ssl ?? true), onChange: value => update('verify_ssl', value === 'true'), onDelete: () => { void remove('splunk.verify_ssl') } }),
    React.createElement(SettingRow, { label: 'Max events', value: String(splunk.max_events ?? ''), onChange: value => update('max_events', Number(value || 0)), onDelete: () => { void remove('splunk.max_events') } }),
    React.createElement(SettingRow, { label: 'Risk tolerance', value: String(splunk.risk_tolerance ?? ''), onChange: value => update('risk_tolerance', Number(value || 0)), onDelete: () => { void remove('splunk.risk_tolerance') } }),
    React.createElement(SettingRow, { label: 'Allow drafts', value: String(splunk.detection_write_enabled ?? false), onChange: value => update('detection_write_enabled', value === 'true'), onDelete: () => { void remove('splunk.detection_write_enabled') } }),
    React.createElement(SettingRow, { label: 'Allow enable', value: String(splunk.detection_enable_enabled ?? false), onChange: value => update('detection_enable_enabled', value === 'true'), onDelete: () => { void remove('splunk.detection_enable_enabled') } }),
    React.createElement('div', { className: css.actions },
      React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => { void save() } }, 'Save settings'),
      React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void testSplunk() } }, 'Test Splunk'),
      React.createElement(TestStatus, { result: test }),
    ),
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
  )
}
