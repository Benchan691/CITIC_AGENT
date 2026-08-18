import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'

type Settings = Record<string, Record<string, unknown>>
type Account = Record<string, string>
type TestResult = { kind: 'pending' | 'ok' | 'fail'; text: string }

const CHANNEL = '/splunk-zimbra-config'

async function rpc(connection: ConnectionHandle, name: string, payload: Record<string, unknown> = {}) {
  const result = await connection.rpc.call(CHANNEL, name, payload)
  if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`)
  return result.value
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function TextInput({ value, onChange, type = 'text', placeholder = '' }: {
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return React.createElement('input', {
    className: css.input,
    type,
    value: value ?? '',
    placeholder,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
  })
}

function SettingRow({ label, value, onChange, onDelete, type = 'text', placeholder = '' }: {
  label: string
  value: string
  onChange: (value: string) => void
  onDelete: () => void
  type?: string
  placeholder?: string
}) {
  return React.createElement(
    'div',
    { className: css.row },
    React.createElement('label', null, label),
    React.createElement(TextInput, { value, onChange, type, placeholder }),
    React.createElement('button', { className: css.deleteButton, type: 'button', onClick: onDelete }, 'Delete'),
  )
}

function TestStatus({ result }: { result: TestResult | null }) {
  if (!result) return null
  const className = result.kind === 'ok'
    ? `${css.testResult} ${css.testOk}`
    : result.kind === 'fail'
      ? `${css.testResult} ${css.testFail}`
      : css.testResult
  return React.createElement('span', { className, role: 'status' }, result.text)
}

function AccountEditor({ account, onSave }: {
  account: Account
  onSave: (account: Account) => void
}) {
  const [draft, setDraft] = useState(account)
  useEffect(() => { setDraft(account) }, [account])

  return React.createElement(
    'div',
    { className: css.account },
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Label'), React.createElement(TextInput, { value: draft.label || '', onChange: (value) => setDraft({ ...draft, label: value }) })),
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Email'), React.createElement(TextInput, { value: draft.email || '', onChange: (value) => setDraft({ ...draft, email: value }) })),
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Password'), React.createElement(TextInput, { value: draft.password || '', onChange: (value) => setDraft({ ...draft, password: value }), type: 'password' })),
    React.createElement(
      'div',
      { className: css.actions },
      React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => onSave(draft) }, 'Add account'),
    ),
  )
}

function ConnectedAccountRow({
  account,
  testResult,
  onTest,
  onDelete,
}: {
  account: Account
  testResult: TestResult | null
  onTest: (id: string) => void
  onDelete: (id: string) => void
}) {
  const title = account.label || account.email || account.id
  const meta = account.email && account.email !== title ? account.email : ''
  return React.createElement(
    'div',
    { className: css.connectedAccount },
    React.createElement(
      'div',
      { className: css.accountIdentity },
      React.createElement('strong', null, title),
      meta ? React.createElement('span', { className: css.accountMeta }, meta) : null,
    ),
    React.createElement(
      'div',
      { className: css.accountActions },
      React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => onTest(account.id) }, 'Test'),
      React.createElement(TestStatus, { result: testResult }),
      React.createElement('button', { className: css.deleteButton, type: 'button', onClick: () => onDelete(account.id) }, 'Delete'),
    ),
  )
}

export function SplunkZimbraForm({ connection }: { connection: ConnectionHandle }) {
  const [status, setStatus] = useState('Loading...')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [newAccountNonce, setNewAccountNonce] = useState(0)
  const [splunkTest, setSplunkTest] = useState<TestResult | null>(null)
  const [accountTests, setAccountTests] = useState<Record<string, TestResult>>({})
  const blankAccount = useMemo(() => ({ id: '', label: '', email: '', password: '' }), [newAccountNonce])

  const load = useCallback(async () => {
    setStatus('Loading...')
    try {
      const [nextSettings, nextAccounts] = await Promise.all([
        rpc(connection, 'get-settings'),
        rpc(connection, 'list-accounts'),
      ])
      setSettings(nextSettings as Settings)
      setAccounts(((nextAccounts as { accounts?: Account[] }).accounts) || [])
      setStatus('')
    } catch (error) {
      setStatus(errorText(error))
    }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const updateNested = (group: string, key: string, value: unknown) => {
    setSettings((current) => ({ ...current!, [group]: { ...current![group], [key]: value } }))
  }

  const saveSettings = async () => {
    try {
      setStatus('Saving...')
      const value = await rpc(connection, 'update-settings', settings ?? {})
      setSettings(value as Settings)
      setStatus('Saved')
    } catch (error) {
      setStatus(errorText(error))
    }
  }

  const deleteSetting = async (key: string) => {
    try {
      setStatus('Deleting...')
      const value = await rpc(connection, 'delete-setting', { key })
      setSettings(value as Settings)
      setStatus('Deleted')
    } catch (error) {
      setStatus(errorText(error))
    }
  }

  const saveAccount = async (account: Account) => {
    try {
      setStatus('Saving account...')
      await rpc(connection, 'add-account', account)
      setNewAccountNonce((value) => value + 1)
      await load()
    } catch (error) {
      setStatus(errorText(error))
    }
  }

  const deleteAccount = async (id: string) => {
    try {
      setStatus('Deleting account...')
      await rpc(connection, 'delete-account', { id })
      setAccountTests((current) => {
        const next = { ...current }
        delete next[id]
        return next
      })
      await load()
    } catch (error) {
      setStatus(errorText(error))
    }
  }

  const testAccount = async (id: string) => {
    setAccountTests((current) => ({ ...current, [id]: { kind: 'pending', text: 'Testing…' } }))
    try {
      await rpc(connection, 'test-account', { id })
      setAccountTests((current) => ({ ...current, [id]: { kind: 'ok', text: 'Account test succeeded' } }))
    } catch (error) {
      setAccountTests((current) => ({ ...current, [id]: { kind: 'fail', text: errorText(error) } }))
    }
  }

  const testSplunk = async () => {
    setSplunkTest({ kind: 'pending', text: 'Testing…' })
    try {
      const value = await rpc(connection, 'test-splunk') as { index_count?: number }
      setSplunkTest({ kind: 'ok', text: `Splunk OK (${String(value.index_count ?? 0)} indexes)` })
    } catch (error) {
      setSplunkTest({ kind: 'fail', text: errorText(error) })
    }
  }

  if (settings == null) return React.createElement('div', { className: css.loading }, status)

  return React.createElement(
    'div',
    { className: css.form },
    React.createElement('p', { className: css.description }, 'Splunk and Zimbra connections for the analyst agent.'),
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
    React.createElement(
      'section',
      { className: css.section },
      React.createElement('h3', null, 'Splunk'),
      React.createElement(SettingRow, { label: 'URL', value: String(settings.splunk.url || ''), onChange: (value) => updateNested('splunk', 'url', value), onDelete: () => { void deleteSetting('splunk.url') } }),
      React.createElement(SettingRow, { label: 'Username', value: String(settings.splunk.username || ''), onChange: (value) => updateNested('splunk', 'username', value), onDelete: () => { void deleteSetting('splunk.username') } }),
      React.createElement(SettingRow, { label: 'Password', value: '', type: 'password', placeholder: settings.splunk.has_password ? 'Stored password is set' : '', onChange: (value) => updateNested('splunk', 'password', value), onDelete: () => { void deleteSetting('splunk.password') } }),
      React.createElement(SettingRow, { label: 'Verify SSL', value: String(settings.splunk.verify_ssl ?? true), onChange: (value) => updateNested('splunk', 'verify_ssl', value === 'true'), onDelete: () => { void deleteSetting('splunk.verify_ssl') } }),
      React.createElement(SettingRow, { label: 'Max events', value: String(settings.splunk.max_events ?? ''), onChange: (value) => updateNested('splunk', 'max_events', Number(value || 0)), onDelete: () => { void deleteSetting('splunk.max_events') } }),
      React.createElement(SettingRow, { label: 'Risk tolerance', value: String(settings.splunk.risk_tolerance ?? ''), onChange: (value) => updateNested('splunk', 'risk_tolerance', Number(value || 0)), onDelete: () => { void deleteSetting('splunk.risk_tolerance') } }),
      React.createElement(SettingRow, { label: 'Allow drafts', value: String(settings.splunk.detection_write_enabled ?? false), onChange: (value) => updateNested('splunk', 'detection_write_enabled', value === 'true'), onDelete: () => { void deleteSetting('splunk.detection_write_enabled') } }),
      React.createElement(SettingRow, { label: 'Allow enable', value: String(settings.splunk.detection_enable_enabled ?? false), onChange: (value) => updateNested('splunk', 'detection_enable_enabled', value === 'true'), onDelete: () => { void deleteSetting('splunk.detection_enable_enabled') } }),
      React.createElement('div', { className: css.actions },
        React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => { void saveSettings() } }, 'Save settings'),
        React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void testSplunk() } }, 'Test Splunk'),
        React.createElement(TestStatus, { result: splunkTest }),
      ),
    ),
    React.createElement(
      'section',
      { className: css.section },
      React.createElement('h3', null, 'Zimbra'),
      React.createElement(SettingRow, { label: 'Host', value: String(settings.zimbra.host || ''), onChange: (value) => updateNested('zimbra', 'host', value), onDelete: () => { void deleteSetting('zimbra.host') } }),
      React.createElement(SettingRow, { label: 'Verify SSL', value: String(settings.zimbra.verify_ssl ?? true), onChange: (value) => updateNested('zimbra', 'verify_ssl', value === 'true'), onDelete: () => { void deleteSetting('zimbra.verify_ssl') } }),
      React.createElement(SettingRow, { label: 'Timeout', value: String(settings.zimbra.timeout ?? ''), onChange: (value) => updateNested('zimbra', 'timeout', Number(value || 0)), onDelete: () => { void deleteSetting('zimbra.timeout') } }),
      React.createElement(SettingRow, { label: 'Allow send', value: String(settings.zimbra.allow_send ?? false), onChange: (value) => updateNested('zimbra', 'allow_send', value === 'true'), onDelete: () => { void deleteSetting('zimbra.allow_send') } }),
      React.createElement(SettingRow, { label: 'Attachment bytes', value: String(settings.zimbra.max_attachment_bytes ?? ''), onChange: (value) => updateNested('zimbra', 'max_attachment_bytes', Number(value || 0)), onDelete: () => { void deleteSetting('zimbra.max_attachment_bytes') } }),
      React.createElement(SettingRow, { label: 'Text characters', value: String(settings.zimbra.max_attachment_text_chars ?? ''), onChange: (value) => updateNested('zimbra', 'max_attachment_text_chars', Number(value || 0)), onDelete: () => { void deleteSetting('zimbra.max_attachment_text_chars') } }),
      React.createElement('div', { className: css.actions }, React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => { void saveSettings() } }, 'Save settings')),
    ),
    React.createElement(
      'section',
      { className: css.section },
      React.createElement('h3', null, 'Accounts'),
      accounts.length === 0 ? React.createElement('p', { className: css.description }, 'No connected accounts.') : null,
      accounts.map((account) => React.createElement(ConnectedAccountRow, {
        key: account.id,
        account,
        testResult: accountTests[account.id] ?? null,
        onTest: (id) => { void testAccount(id) },
        onDelete: (id) => { void deleteAccount(id) },
      })),
      React.createElement(AccountEditor, { key: `new-${newAccountNonce}`, account: blankAccount, onSave: (draft) => { void saveAccount(draft) } }),
    ),
  )
}
