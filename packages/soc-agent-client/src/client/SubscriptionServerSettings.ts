import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React from 'react'
import { ServiceConnectionSettings } from './ServiceConnectionSettings.ts'

export function SubscriptionServerSettings({ connection }: { connection: ConnectionHandle }) {
  return React.createElement(ServiceConnectionSettings, { connection, service: 'subscription_server', label: 'Subscription server', endpoint: 'test-subscription-server' })
}
