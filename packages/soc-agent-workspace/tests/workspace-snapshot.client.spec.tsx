// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { WorkspaceBrowserProps, WorkspacePickerProps } from '../src/client/contract/slots.ts'
import { WorkspaceBrowser } from '../src/client/WorkspaceBrowser.tsx'
import { WorkspacePicker } from '../src/client/WorkspacePicker.tsx'
import { createWorkspaceViewStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)
beforeEach(() => { localStorage.clear() })

const t = makeTranslate(zh, commonZh)
const sid = (id: string) => id as SessionId
const wid = (id: string) => id as WorkspaceId

function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

const session: SessionSummary = {
  id: sid('soc-session'), displayTitle: 'SOC session', running: false, blank: false, updatedAt: 2,
}
const sessionState: SessionListState = {
  ids: [session.id], byId: { [session.id]: session }, current: undefined, phase: 'ready',
  subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
}
const workspace: WorkspaceView = {
  workspaceId: wid('soc-workspace'), path: '/projects/soc', title: 'SOC workspace',
  sessionIds: [session.id], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}
const workspaceState: WorkspaceListState = {
  items: [workspace], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  baselinesReady: true, recentWorkspaceId: workspace.workspaceId,
}

type WorkspaceViewStore = ReturnType<ReturnType<typeof createWorkspaceViewStore>['create']>

function browserProps(store: WorkspaceViewStore): WorkspaceBrowserProps {
  return {
    wide: true,
    expandSidebar: vi.fn(),
    useSessions: hook(sessionState),
    useWorkspaces: hook(workspaceState),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    startSession: vi.fn(),
    open: vi.fn(),
    searchSessions: vi.fn(async () => ({ items: [], hasMore: false })),
    searchResultLimit: 20,
    renameSession: vi.fn(async () => {}),
    deleteSession: vi.fn(async () => {}),
    forkSession: vi.fn(),
    renameWorkspace: vi.fn(async () => {}),
    deleteWorkspace: vi.fn(async () => {}),
    archiveSession: vi.fn(async () => {}),
    insertWorkspaceBefore: vi.fn(async () => {}),
    insertSessionBefore: vi.fn(async () => {}),
    createWorkspace: vi.fn(async () => workspace),
    t,
  }
}

describe('workspace visual snapshots', () => {
  it('pins the grouped workspace browser list', () => {
    const store = createWorkspaceViewStore().create()
    const view = render(<WorkspaceBrowser {...browserProps(store)} />)
    expect(view.container).toMatchSnapshot()
  })

  it('pins the open workspace picker', () => {
    const anchor = document.createElement('button')
    anchor.getBoundingClientRect = () => ({
      top: 10, left: 20, width: 30, height: 40, right: 50, bottom: 50,
      x: 20, y: 10, toJSON: () => ({}),
    })
    const sessions: SessionListState = {
      ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {},
      jobsBySession: {}, currentAddress: undefined,
    }
    const items = [workspace, { ...workspace, workspaceId: wid('soc-workspace-2'), title: 'SOC workspace 2' }]
    const workspaces: WorkspaceListState = {
      ...workspaceState, items, recentWorkspaceId: items[0]?.workspaceId,
    }
    const view = render(
      <WorkspacePicker
        open
        anchorRef={{ current: anchor }}
        useSessions={hook(sessions)}
        useWorkspaces={hook(workspaces)}
        onPick={vi.fn()}
        onClose={vi.fn()}
        createWorkspace={vi.fn(async () => workspace)}
        t={t as WorkspacePickerProps['t']}
      />,
    )
    expect(view.baseElement).toMatchSnapshot()
  })
})
