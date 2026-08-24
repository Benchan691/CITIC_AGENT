import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'
import { Account, errorText, rpc, TestResult, TestStatus, TextInput } from './settings-common.ts'

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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('Loading...')

  const load = useCallback(async () => {
    try {
      const nextAccounts = await rpc(connection, 'list-accounts')
      setAccounts(((nextAccounts as { accounts?: Account[] }).accounts) || [])
      setLoaded(true)
      setStatus('')
    } catch (error) { setStatus(errorText(error)) }
  }, [connection])

  useEffect(() => { void load() }, [load])

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

  if (!loaded) return React.createElement('div', { className: css.loading }, status)
  return React.createElement(React.Fragment, null,
    React.createElement('section', { className: css.section },
      React.createElement('h3', null, 'Accounts'),
      React.createElement('p', { className: css.description }, 'Zimbra server settings are configured in the server .env file.'),
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
