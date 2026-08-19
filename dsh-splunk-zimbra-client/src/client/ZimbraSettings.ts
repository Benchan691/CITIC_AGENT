import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'
import { Account, errorText, rpc, SettingRow, Settings, TestResult, TestStatus, TextInput } from './settings-common.ts'

function AccountEditor({ onSave }: { onSave: (account: Account) => void }) {
  const [draft, setDraft] = useState<Account>({ id: '', label: '', email: '', password: '' })
  return React.createElement('div', { className: css.account },
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Label'), React.createElement(TextInput, { value: draft.label, onChange: value => setDraft({ ...draft, label: value }) })),
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Email'), React.createElement(TextInput, { value: draft.email, onChange: value => setDraft({ ...draft, email: value }) })),
    React.createElement('div', { className: css.row }, React.createElement('label', null, 'Password'), React.createElement(TextInput, { value: draft.password, type: 'password', onChange: value => setDraft({ ...draft, password: value }) })),
    React.createElement('div', { className: css.actions }, React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => onSave(draft) }, 'Add account')),
  )
}

export function ZimbraSettings({ connection }: { connection: ConnectionHandle }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [status, setStatus] = useState('Loading...')

  const load = useCallback(async () => {
    try {
      const [nextSettings, nextAccounts] = await Promise.all([rpc(connection, 'get-settings'), rpc(connection, 'list-accounts')])
      setSettings(nextSettings as Settings)
      setAccounts(((nextAccounts as { accounts?: Account[] }).accounts) || [])
      setStatus('')
    } catch (error) { setStatus(errorText(error)) }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const update = (key: string, value: unknown) => setSettings(current => ({ ...current!, zimbra: { ...current!.zimbra, [key]: value } }))
  const save = async () => {
    try { setStatus('Saving...'); setSettings(await rpc(connection, 'update-settings', settings ?? {}) as Settings); setStatus('Saved') }
    catch (error) { setStatus(errorText(error)) }
  }
  const remove = async (key: string) => {
    try { setStatus('Deleting...'); setSettings(await rpc(connection, 'delete-setting', { key }) as Settings); setStatus('Deleted') }
    catch (error) { setStatus(errorText(error)) }
  }
  const saveAccount = async (account: Account) => {
    try { setStatus('Saving account...'); await rpc(connection, 'add-account', account); await load() }
    catch (error) { setStatus(errorText(error)) }
  }
  const deleteAccount = async (id: string) => {
    try { setStatus('Deleting account...'); await rpc(connection, 'delete-account', { id }); await load() }
    catch (error) { setStatus(errorText(error)) }
  }
  const testAccount = async (id: string) => {
    setTests(current => ({ ...current, [id]: { kind: 'pending', text: 'Testing…' } }))
    try { await rpc(connection, 'test-account', { id }); setTests(current => ({ ...current, [id]: { kind: 'ok', text: 'Account test succeeded' } })) }
    catch (error) { setTests(current => ({ ...current, [id]: { kind: 'fail', text: errorText(error) } })) }
  }

  if (!settings) return React.createElement('div', { className: css.loading }, status)
  const zimbra = settings.zimbra
  return React.createElement(React.Fragment, null,
    React.createElement('section', { className: css.section },
      React.createElement('h3', null, 'Zimbra'),
      React.createElement(SettingRow, { label: 'Host', value: String(zimbra.host || ''), onChange: value => update('host', value), onDelete: () => { void remove('zimbra.host') } }),
      React.createElement(SettingRow, { label: 'Verify SSL', value: String(zimbra.verify_ssl ?? true), onChange: value => update('verify_ssl', value === 'true'), onDelete: () => { void remove('zimbra.verify_ssl') } }),
      React.createElement(SettingRow, { label: 'Timeout', value: String(zimbra.timeout ?? ''), onChange: value => update('timeout', Number(value || 0)), onDelete: () => { void remove('zimbra.timeout') } }),
      React.createElement(SettingRow, { label: 'Allow send', value: String(zimbra.allow_send ?? false), onChange: value => update('allow_send', value === 'true'), onDelete: () => { void remove('zimbra.allow_send') } }),
      React.createElement(SettingRow, { label: 'Attachment bytes', value: String(zimbra.max_attachment_bytes ?? ''), onChange: value => update('max_attachment_bytes', Number(value || 0)), onDelete: () => { void remove('zimbra.max_attachment_bytes') } }),
      React.createElement(SettingRow, { label: 'Text characters', value: String(zimbra.max_attachment_text_chars ?? ''), onChange: value => update('max_attachment_text_chars', Number(value || 0)), onDelete: () => { void remove('zimbra.max_attachment_text_chars') } }),
      React.createElement('div', { className: css.actions }, React.createElement('button', { className: css.primaryButton, type: 'button', onClick: () => { void save() } }, 'Save settings')),
    ),
    React.createElement('section', { className: css.section },
      React.createElement('h3', null, 'Accounts'),
      accounts.length === 0 ? React.createElement('p', { className: css.description }, 'No connected accounts.') : null,
      accounts.map(account => React.createElement('div', { className: css.connectedAccount, key: account.id },
        React.createElement('div', { className: css.accountIdentity }, React.createElement('strong', null, account.label || account.email || account.id), account.email && account.email !== account.label ? React.createElement('span', { className: css.accountMeta }, account.email) : null),
        React.createElement('div', { className: css.accountActions }, React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void testAccount(account.id) } }, 'Test'), React.createElement(TestStatus, { result: tests[account.id] ?? null }), React.createElement('button', { className: css.deleteButton, type: 'button', onClick: () => { void deleteAccount(account.id) } }, 'Delete')),
      )),
      React.createElement(AccountEditor, { onSave: account => { void saveAccount(account) } }),
    ),
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
  )
}
