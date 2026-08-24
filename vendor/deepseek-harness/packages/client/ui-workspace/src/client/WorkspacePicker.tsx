/**
 * Workspace pick/add flow. WorkspacePickFlow is the reusable core (menu +
 * creation error dialog) consumed directly by WorkspaceBrowser and wrapped by
 * WorkspacePicker for the conversation empty-state slot registration.
 */
import type { RefObject } from 'react'
import { useCallback, useEffect, useState } from 'react'
import {
  Button, IconFolderClose16, IconPlusOutline16, Menu, Modal, type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { WorkspaceCreateError } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  WorkspaceId, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspacePickerProps } from './contract/slots.ts'
import css from './WorkspacePicker.module.css'

const ADD_WORKSPACE = '::add-workspace'

/** Core flow props: the owner supplies popover control and pick semantics. */
export interface WorkspacePickFlowProps {
  /** The standard locale seat, forwarded by whichever slot entry hosts the flow. */
  t: WorkspacePickerProps['t']
  /** Popover visibility (anchor button toggle state, owner-local). */
  open: boolean
  /** The anchor button element — the popover's placement anchor. */
  anchorRef?: RefObject<HTMLElement | null> | undefined
  /** Selector hook over the workspace list (framework standard hook). */
  useWorkspaces: <S>(selector: (state: WorkspaceListState) => S) => S
  /** Create a logical chat folder. */
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

/**
 * Render the pick menu plus the adoption error dialog.
 * @param props - owner-controlled flow props.
 * @returns menu + dialog elements.
 */
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
  const [errorOpen, setErrorOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [pickingFolder, setPickingFolder] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  // A pending create owns the surface until the Host accepts or rejects it.
  const flowBusy = pickingFolder
  const addEntries: MenuEntry[] = [
    { id: ADD_WORKSPACE, label: t('menu.addWorkspace'), icon: <IconPlusOutline16 size={16} />, disabled: flowBusy },
  ]
  // With workspaces listed, the add action pins below the scroll region
  // (divider + always visible); otherwise it IS the menu.
  const pinAdd = !addOnly && workspaces.length > 0
  const items: MenuEntry[] = pinAdd
    ? workspaces.map(workspace => ({
      id: workspace.workspaceId,
      label: workspace.title,
      icon: <IconFolderClose16 size={16} />,
      disabled: flowBusy,
    }))
    : addEntries
  const closeModal = (): void => {
    setErrorOpen(false)
    setModalError(null)
  }

  /** Create a logical folder; failures land in the retryable error dialog. */
  const createFolder = (name: string): Promise<void> =>
    createWorkspace({ path: name.trim() }).then((workspace) => {
      setNameOpen(false)
      onPick(workspace.workspaceId)
    }).catch((reason: unknown) => {
      if (!(reason instanceof WorkspaceCreateError)) {
        console.error('[ui-workspace] folder creation failed', reason)
      }
      setNameOpen(false)
      setModalError(reason instanceof WorkspaceCreateError ? reason.message : t('folderError.generic'))
      setErrorOpen(true)
    })

  const openNameDialog = useCallback((): void => {
    onClose()
    setErrorOpen(false)
    setModalError(null)
    setNameDraft('')
    setNameOpen(true)
  }, [onClose])

  // A menu exists to disambiguate between targets. With no workspaces listed
  // and the add action the only entry left, the anchor gesture IS that action:
  // a one-row popover would cost a click and offer nothing to choose between.
  // The owner's open request is consumed the same way selecting the entry
  // would consume it (close the popover, raise the flow). An empty list is
  // only final once the baseline lands — until then the menu stays up with its
  // loading status instead of jumping into a flow the arriving list would have
  // made unnecessary; the add-only surface lists nothing and never waits.
  const listSettled = addOnly || workspaceSnapshot.phase === 'ready'
  const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1
  // `flowBusy` gates this exactly as it disables the equivalent menu entry: a
  // pick still being adopted owns the surface until it settles.
  useEffect(() => {
    if (open && addIsTheOnlyEntry && !flowBusy) openNameDialog()
  }, [open, addIsTheOnlyEntry, flowBusy, openNameDialog])

  const handleSelect = (id: string): void => {
    if (id === ADD_WORKSPACE) {
      openNameDialog()
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
      {open && !addIsTheOnlyEntry && workspaceSnapshot.phase === 'pending' && <div className={css.menuStatus} role="status">{t('picker.loading')}</div>}
      <Modal
        open={errorOpen}
        onClose={closeModal}
        closeLabel={t('close')}
        title={t('folderError.title')}
        footer={(
          <>
            <Button variant="outline" className={css.modalAction} onClick={closeModal}>{t('cancel')}</Button>
            <Button variant="primary" className={css.modalAction} onClick={openNameDialog}>{t('folderError.retry')}</Button>
          </>
        )}
      >
        <div className={css.modalError} role="alert">{modalError}</div>
      </Modal>
      <Modal
        open={nameOpen}
        onClose={() => { setNameOpen(false) }}
        closeLabel={t('close')}
        title={t('new.folder.title')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setNameOpen(false) }}>{t('cancel')}</Button>
            <Button
              variant="primary"
              disabled={nameDraft.trim() === '' || flowBusy}
              onClick={() => {
                setPickingFolder(true)
                void createFolder(nameDraft).finally(() => { setPickingFolder(false) })
              }}
            >{t('create')}</Button>
          </>
        )}
      >
        <input
          className={css.modalInput}
          value={nameDraft}
          autoFocus
          aria-label={t('field.workspaceName')}
          onChange={(event) => { setNameDraft(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && nameDraft.trim() !== '' && !flowBusy) {
              setPickingFolder(true)
              void createFolder(nameDraft).finally(() => { setPickingFolder(false) })
            }
          }}
        />
      </Modal>
    </>
  )
}

/**
 * The conversation empty-state registration: adapts the owner share to the
 * core flow (all state and semantics live in the flow / the owner).
 * @param props - empty-state slot props (owner share + injected creation callback).
 * @returns the flow element.
 */
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
