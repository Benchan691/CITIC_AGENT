import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React from 'react'
import { SplunkSettings } from './SplunkSettings.ts'
import { ZimbraSettings } from './ZimbraSettings.ts'

/** Compatibility composition for callers of the original component name. */
export function SplunkZimbraForm({ connection }: { connection: ConnectionHandle }) {
  return React.createElement(React.Fragment, null,
    React.createElement(SplunkSettings, { connection }),
    React.createElement(ZimbraSettings, { connection }),
  )
}
