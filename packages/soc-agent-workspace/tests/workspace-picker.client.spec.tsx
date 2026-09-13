// @vitest-environment jsdom
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SessionListState } from 'dsh-soc-agent-session-controller/client'
import type {
  WorkspaceId, WorkspaceSnapshot, WorkspaceView,
} from 'dsh-soc-agent-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionPendingInteractionSnapshot } from 'dsh-soc-agent-ui-session/client'
import type { WorkspacePickerProps } from '../src/client/contract/slots.ts'
import { WorkspacePicker } from '../src/client/WorkspacePicker.tsx'
import { zh } from '../src/client/locales.ts'

const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })
const t: WorkspacePickerProps['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

const wid = (id: string) => id as WorkspaceId
function workspace(id: string, title = id): WorkspaceView {
  return {
    workspaceId: wid(id), path: `/private/${id}`, title, sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}
const sessions: SessionListState = {
  ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
}
const noPendingInteraction: SessionPendingInteractionSnapshot = new Map()
const hook = <T,>(snapshot: T) => <S,>(selector: (state: T) => S): S => selector(snapshot)
const workspaceState = (items: readonly WorkspaceView[]): WorkspaceSnapshot => ({
  items, archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
})

function mount(
  items: readonly WorkspaceView[] = [workspace('alpha', 'Alpha')],
  createWorkspace = vi.fn(async () => workspace('created')),
) {
  const onPick = vi.fn()
  const onClose = vi.fn()
  const element = document.createElement('button')
  element.getBoundingClientRect = () => ({
    top: 10, left: 20, width: 30, height: 40, right: 50, bottom: 50,
    x: 20, y: 10, toJSON: () => ({}),
  })
  const view = render(
    <WorkspacePicker
      open
      anchorRef={{ current: element }}
      useSessions={hook(sessions)}
      useSessionPendingInteraction={hook(noPendingInteraction)}
      usePanelInfo={usePanelInfo}
      useResource={useResource}
      useWorkspaces={hook(workspaceState(items))}
      onPick={onPick}
      onClose={onClose}
      createWorkspace={createWorkspace}
      useDirectoryFlow={hook(false)}
      renderSlot={() => null}
      t={t}
    />,
  )
  return { view, onPick, onClose, createWorkspace }
}

function chooseAdd(): void {
  fireEvent.click(screen.getByRole('menuitem', { name: '添加工作区…' }))
}

describe('WorkspacePicker', () => {
  it('lists same-title Workspaces separately and forwards the selected id', () => {
    const b = mount([workspace('alpha', 'Shared'), workspace('beta', 'Shared')])
    const entries = screen.getAllByRole('menuitem', { name: 'Shared' })
    expect(entries).toHaveLength(2)
    fireEvent.click(entries[1]!)
    expect(b.onPick).toHaveBeenCalledWith(wid('beta'))
  })

  it('creates a logical Workspace from the SOC-owned name dialog', async () => {
    const created = workspace('created', 'Project')
    const createWorkspace = vi.fn(async () => created)
    const b = mount([workspace('alpha', 'Alpha')], createWorkspace)
    chooseAdd()
    const input = screen.getByRole('textbox', { name: '工作区名称' })
    fireEvent.change(input, { target: { value: 'Project' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(b.createWorkspace).toHaveBeenCalledWith({ path: 'Project' }) })
    await waitFor(() => { expect(b.onPick).toHaveBeenCalledWith(created.workspaceId) })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the logical create dialog directly when it is the only action', async () => {
    mount([])
    await waitFor(() => { expect(screen.getByRole('dialog', { name: '创建工作区' })).toBeTruthy() })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('rejects path-like names before they reach the Host', async () => {
    const b = mount()
    chooseAdd()
    fireEvent.change(screen.getByRole('textbox', { name: '工作区名称' }), { target: { value: 'bad/name' } })
    expect(screen.getByRole('alert').textContent).toContain('不能包含斜杠')
    expect((screen.getByRole('button', { name: '创建' }) as HTMLButtonElement).disabled).toBe(true)
    expect(b.createWorkspace).not.toHaveBeenCalled()
  })

  it('keeps a failed logical create retryable and closes cleanly on cancel', async () => {
    const createWorkspace = vi.fn(async () => { throw new Error('workspace unavailable') })
    const b = mount([workspace('alpha')], createWorkspace)
    chooseAdd()
    fireEvent.change(screen.getByRole('textbox', { name: '工作区名称' }), { target: { value: 'Project' } })
    fireEvent.click(screen.getByRole('button', { name: '创建' }))
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe('workspace unavailable') })
    expect(b.onPick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
