// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionListState, WorkspaceId, WorkspaceListState, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { WorkspacePickerProps } from '../src/client/contract/slots.ts'
import { WorkspacePicker } from '../src/client/WorkspacePicker.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: WorkspacePickerProps['t'] = makeTranslate(zh, commonZh)
const wid = (id: string) => id as WorkspaceId

function workspace(id: string, title = id): WorkspaceView {
  return {
    workspaceId: wid(id), path: '', title, sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

const sessions: SessionListState = {
  ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
}

function state(items: readonly WorkspaceView[]): WorkspaceListState {
  return {
    items, archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: items[0]?.workspaceId,
  }
}

function mount(
  items: readonly WorkspaceView[] = [workspace('alpha', 'Alpha')],
  createWorkspace = vi.fn(async () => workspace('created', 'Created')),
) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const anchor = document.createElement('button')
  anchor.getBoundingClientRect = () => ({
    top: 10, left: 20, width: 30, height: 40, right: 50, bottom: 50,
    x: 20, y: 10, toJSON: () => ({}),
  })
  const view = render(
    <WorkspacePicker
      open
      anchorRef={{ current: anchor }}
      useSessions={hook(sessions)}
      useWorkspaces={hook(state(items))}
      onPick={onPick}
      onClose={onClose}
      createWorkspace={createWorkspace}
      t={t}
    />,
  )
  return { view, onPick, onClose, createWorkspace }
}

function chooseAdd(): void {
  fireEvent.click(screen.getByRole('menuitem', { name: '新建文件夹…' }))
}

function submitFolder(name: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: '文件夹名称' }), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: '创建' }))
}

describe('WorkspacePicker', () => {
  it('lists same-title folders separately and forwards the selected id', () => {
    const b = mount([workspace('alpha', 'Shared'), workspace('beta', 'Shared')])
    fireEvent.click(screen.getAllByRole('menuitem', { name: 'Shared' })[1]!)
    expect(b.onPick).toHaveBeenCalledWith(wid('beta'))
  })

  it('creates a logical folder by name and selects it immediately', async () => {
    const created = workspace('created', 'Customer A')
    const createWorkspace = vi.fn(async () => created)
    const b = mount(undefined, createWorkspace)
    chooseAdd()
    submitFolder('Customer A')
    await waitFor(() => { expect(createWorkspace).toHaveBeenCalledWith({ path: 'Customer A' }) })
    expect(b.onClose).toHaveBeenCalled()
    expect(b.onPick).toHaveBeenCalledWith(created.workspaceId)
  })

  it('opens the folder dialog on an empty first-run list', () => {
    mount([])
    expect(screen.getByRole('dialog', { name: '新建文件夹' })).toBeTruthy()
  })

  it('cancels folder creation without changing selection', () => {
    const b = mount()
    chooseAdd()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog', { name: '新建文件夹' })).toBeNull()
    expect(b.createWorkspace).not.toHaveBeenCalled()
    expect(b.onPick).not.toHaveBeenCalled()
  })

  it('shows a concise error for malformed or failed folder responses', async () => {
    const b = mount(undefined, vi.fn(async () => { throw new Error('invalid_union: raw zod detail') }))
    chooseAdd()
    submitFolder('Broken')
    await waitFor(() => { expect(screen.getByRole('dialog', { name: '无法创建文件夹' })).toBeTruthy() })
    expect(screen.getByRole('alert').textContent).toBe('无法创建文件夹，请重试。')
    expect(screen.getByRole('alert').textContent).not.toContain('invalid_union')
    expect(b.onPick).not.toHaveBeenCalled()
  })

  it('keeps menu actions disabled while folder persistence is pending', async () => {
    let resolve!: (value: WorkspaceView) => void
    const pending = new Promise<WorkspaceView>((settle) => { resolve = settle })
    const b = mount(undefined, vi.fn(() => pending))
    chooseAdd()
    submitFolder('Pending')
    expect(screen.getByRole('button', { name: '创建' }).hasAttribute('disabled')).toBe(true)
    await act(async () => { resolve(workspace('pending')); await pending })
    expect(b.onPick).toHaveBeenCalledWith(wid('pending'))
  })
})
