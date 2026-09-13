/**
 * SOC logical Workspace pick/add flow. Existing Workspaces retain the rc.2
 * picker menu, while creation asks only for a logical name. The authenticated
 * Host boundary maps that name into the user's private Workspace root; no
 * browser or native directory-picker implementation is mounted. The standard
 * directory-flow contract remains available for compatible contributors.
 */
import type { RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Button, IconFolderClose16, IconPlusOutline16, Menu, Modal, type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  WorkspaceId, WorkspaceSnapshot, WorkspaceView,
} from 'dsh-soc-agent-workspace-controller/client'
import type { WorkspacePickerProps } from './contract/slots.ts'
import css from './WorkspacePicker.module.css'

const ADD_WORKSPACE = '::add-workspace'

/** Core flow props shared by the sidebar and conversation picker. */
export interface WorkspacePickFlowProps {
  /** The standard locale seat, forwarded by whichever slot entry hosts the flow. */
  t: WorkspacePickerProps['t']
  /** Popover visibility (anchor button toggle state, owner-local). */
  open: boolean
  /** The anchor button element — the popover's placement anchor. */
  anchorRef?: RefObject<HTMLElement | null> | undefined
  /** Selector hook over the workspace list (framework standard hook). */
  useWorkspaces: <S>(selector: (state: WorkspaceSnapshot) => S) => S
  /** Create a logical Workspace inside the authenticated user's private root. */
  createWorkspace: (input: { path: string }) => Promise<WorkspaceView>
  /** A real Workspace was picked or created. */
  onPick: (workspaceId: WorkspaceId) => void
  /** Close the popover (outside click / Escape / post-pick). */
  onClose: () => void
  /** Only offer the add action, hide existing workspaces. */
  addOnly?: boolean
  /** Menu opening direction relative to the anchor. */
  side?: 'bottom' | 'top' | 'right'
  /** Currently active workspace (trailing check in the picker list). */
  selectedId?: WorkspaceId | undefined
}

function invalidWorkspaceName(name: string): boolean {
  return name === '.' || name === '..' || /[/\\\0]/u.test(name)
}

/** Render the rc.2 Workspace menu plus the SOC-owned logical-name dialog. */
export function WorkspacePickFlow({
  t,
  open,
  anchorRef,
  useWorkspaces,
  createWorkspace,
  onPick,
  onClose,
  addOnly = false,
  side = 'bottom',
  selectedId,
}: WorkspacePickFlowProps) {
  const workspaceSnapshot = useWorkspaces(state => state)
  const workspaces = workspaceSnapshot.items
  const getAnchorRect = useCallback(
    () => anchorRef?.current?.getBoundingClientRect() ?? null,
    [anchorRef],
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const createName = createDraft.trim()
  const nameInvalid = invalidWorkspaceName(createName)
  const createBlocked = creating || createName === '' || nameInvalid

  const addEntries: MenuEntry[] = [{
    id: ADD_WORKSPACE,
    label: t('menu.addWorkspace'),
    icon: <IconPlusOutline16 size={16} />,
    disabled: creating,
  }]
  // With workspaces listed, the add action pins below the scroll region
  // (divider + always visible); otherwise it is the only action.
  const pinAdd = !addOnly && workspaces.length > 0
  const items: MenuEntry[] = pinAdd
    ? workspaces.map(workspace => ({
      id: workspace.workspaceId,
      label: workspace.title,
      icon: <IconFolderClose16 size={16} />,
      disabled: creating,
    }))
    : addEntries

  const closeCreate = (): void => {
    if (creating) return
    setCreateOpen(false)
    setCreateDraft('')
    setCreateError(null)
  }

  const openCreate = useCallback((): void => {
    onClose()
    setCreateDraft('')
    setCreateError(null)
    setCreateOpen(true)
  }, [onClose])

  const confirmCreate = (): void => {
    if (createBlocked) return
    setCreating(true)
    setCreateError(null)
    createWorkspace({ path: createName }).then((workspace) => {
      setCreating(false)
      setCreateOpen(false)
      setCreateDraft('')
      onPick(workspace.workspaceId)
    }).catch((reason: unknown) => {
      setCreating(false)
      setCreateError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // When Add is the only possible choice, the anchor opens the name dialog
  // directly instead of showing a one-row menu.
  const listSettled = addOnly || workspaceSnapshot.phase === 'ready'
  const addIsTheOnlyEntry = !pinAdd && listSettled
  useEffect(() => {
    if (open && addIsTheOnlyEntry && !creating && !createOpen) openCreate()
  }, [open, addIsTheOnlyEntry, creating, createOpen, openCreate])

  const handleSelect = (id: string): void => {
    if (id === ADD_WORKSPACE) {
      openCreate()
      return
    }
    onPick(id as WorkspaceId)
  }

  return (
    <>
      <Menu
        open={open && !addIsTheOnlyEntry}
        anchor={null}
        items={items}
        {...pinAdd ? { footer: addEntries } : {}}
        selectedId={selectedId}
        onSelect={handleSelect}
        onClose={onClose}
        side={side}
        portal
        getAnchorRect={getAnchorRect}
      />
      {open && !addIsTheOnlyEntry && workspaceSnapshot.phase === 'pending' && (
        <div className={css.menuStatus} role="status">{t('picker.loading')}</div>
      )}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        closeLabel={t('close')}
        title={t('create.workspace.title')}
        footer={(
          <>
            <Button variant="outline" className={css.modalAction} disabled={creating} onClick={closeCreate}>{t('cancel')}</Button>
            <Button variant="primary" className={css.modalAction} disabled={createBlocked} onClick={confirmCreate}>{t('create')}</Button>
          </>
        )}
      >
        <input
          className={css.createInput}
          value={createDraft}
          aria-label={t('field.workspaceName')}
          autoFocus
          maxLength={128}
          disabled={creating}
          onChange={(event) => { setCreateDraft(event.target.value); setCreateError(null) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !createBlocked) {
              event.preventDefault()
              confirmCreate()
            }
          }}
        />
        {nameInvalid && <div className={css.modalError} role="alert">{t('create.invalidName')}</div>}
        {creating && <div className={css.menuStatus} role="status">{t('create.pending')}</div>}
        {createError !== null && <div className={css.modalError} role="alert">{createError}</div>}
      </Modal>
    </>
  )
}

/** Conversation empty-state registration around the shared SOC flow. */
export function WorkspacePicker({
  open,
  anchorRef,
  useWorkspaces,
  selectedId,
  onPick,
  onClose,
  createWorkspace,
  t,
}: WorkspacePickerProps) {
  return (
    <WorkspacePickFlow
      t={t}
      open={open}
      anchorRef={anchorRef}
      useWorkspaces={useWorkspaces}
      createWorkspace={createWorkspace}
      selectedId={selectedId}
      onPick={onPick}
      onClose={onClose}
    />
  )
}
