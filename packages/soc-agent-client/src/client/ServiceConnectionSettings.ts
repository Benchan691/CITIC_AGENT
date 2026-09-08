import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React, { useCallback, useEffect, useState } from 'react'
import css from './SplunkZimbraOverlay.module.css'
import { errorText, rpc } from './settings-common.ts'

type ServiceSettings = {
  services?: {
    [service: string]: { status?: string }
  }
}

export function ServiceConnectionSettings({ connection, service, label, endpoint }: {
  connection: ConnectionHandle
  service: string
  label: string
  endpoint: string
}) {
  const [settings, setSettings] = useState<ServiceSettings | null>(null)
  const [status, setStatus] = useState('Loading…')
  const [test, setTest] = useState('')
  const [testState, setTestState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle')

  const load = useCallback(async () => {
    try {
      setSettings(await rpc(connection, 'get-settings') as ServiceSettings)
      setStatus('')
    } catch (error) {
      setStatus(errorText(error))
    }
  }, [connection])

  useEffect(() => { void load() }, [load])

  async function testSplunk() {
    setTestState('checking')
    setTest('Checking…')
    try {
      await rpc(connection, endpoint)
      setTestState('success')
      setTest('Connection verified')
    } catch (error) {
      setTestState('error')
      setTest(errorText(error))
    }
  }

  if (!settings) return React.createElement('div', { className: css.loading }, status)
  const ready = testState === 'success' || (testState !== 'error' && settings.services?.[service]?.status === 'ready')
  const statusLabel = testState === 'checking' ? 'Checking…' : testState === 'success' ? 'Connected' : testState === 'error' ? 'Unavailable' : ready ? 'Configured' : 'Not configured'
  return React.createElement('section', { className: css.section },
    React.createElement('h3', null, label),
    React.createElement('p', { className: css.description }, statusLabel),
    React.createElement('p', { className: css.description }, 'Configuration is managed by the server environment.'),
    React.createElement('button', { className: css.secondaryButton, type: 'button', onClick: () => { void testSplunk() } }, 'Check connection'),
    test ? React.createElement('p', { className: css.status, role: 'status' }, test) : null,
    status ? React.createElement('p', { className: css.status, role: 'status' }, status) : null,
  )
}
