import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'
import { errorText, rpc, TestResult, TestStatus } from './settings-common.ts'

type SubscriptionServerStatus = {
  url?: string
  configured?: boolean
}

type ConnectionSettings = {
  subscription_server?: SubscriptionServerStatus
}

export function SubscriptionServerSettings({ connection }: { connection: ConnectionHandle }) {
  const [settings, setSettings] = useState<ConnectionSettings | null>(null)
  const [status, setStatus] = useState('Loading...')
  const [test, setTest] = useState<TestResult | null>(null)

  const load = useCallback(async () => {
    try {
      setSettings(await rpc(connection, 'get-settings') as ConnectionSettings)
      setStatus('')
    } catch (error) { setStatus(errorText(error)) }
  }, [connection])

  useEffect(() => { void load() }, [load])

  const testConnection = async () => {
    setTest({ kind: 'pending', text: 'Testing…' })
    try {
      const value = await rpc(connection, 'test-subscription-server') as { subscription_count?: number }
      setTest({ kind: 'ok', text: `Subscription server OK (${String(value.subscription_count ?? 0)} subscriptions)` })
    } catch (error) { setTest({ kind: 'fail', text: errorText(error) }) }
  }

  if (!settings) return React.createElement('div', { className: css.loading }, status)
  const server = settings.subscription_server ?? {}
  return React.createElement('section', { className: css.section },
    React.createElement('h3', null, 'Subscription server'),
    React.createElement('p', { className: css.description }, 'Configured through the server .env file. Credentials are never shown here.'),
    React.createElement('p', { className: css.description }, `URL: ${String(server.url || '')}`),
    React.createElement('p', { className: css.description }, server.configured ? 'Credentials configured' : 'Credentials not configured'),
    React.createElement('div', { className: css.actions },
      React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void testConnection() } }, 'Test subscription server'),
      React.createElement(TestStatus, { result: test }),
    ),
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
  )
}
