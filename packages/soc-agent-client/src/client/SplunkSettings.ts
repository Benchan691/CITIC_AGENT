import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React from 'react'
import { ServiceConnectionSettings } from './ServiceConnectionSettings.ts'

export function SplunkSettings({ connection }: { connection: ConnectionHandle }) {
  return React.createElement(ServiceConnectionSettings, { connection, service: 'splunk', label: 'Splunk', endpoint: 'test-splunk' })
}
