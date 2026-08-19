import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import React from 'react'
import css from './SplunkZimbraOverlay.module.css'

export type Settings = Record<string, Record<string, unknown>>
export type Account = Record<string, string>
export type TestResult = { kind: 'pending' | 'ok' | 'fail'; text: string }

export const CHANNEL = '/splunk-zimbra-config'

export async function rpc(connection: ConnectionHandle, name: string, payload: Record<string, unknown> = {}) {
  const result = await connection.rpc.call(CHANNEL, name, payload)
  if (!result?.ok) throw new Error(result?.error?.message || `Request failed: ${name}`)
  return result.value
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function TextInput({ value, onChange, type = 'text', placeholder = '' }: {
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

export function SettingRow({ label, value, onChange, onDelete, type = 'text', placeholder = '' }: {
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

export function TestStatus({ result }: { result: TestResult | null }) {
  if (!result) return null
  const className = result.kind === 'ok'
    ? `${css.testResult} ${css.testOk}`
    : result.kind === 'fail'
      ? `${css.testResult} ${css.testFail}`
      : css.testResult
  return React.createElement('span', { className, role: 'status' }, result.text)
}
