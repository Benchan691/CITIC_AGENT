/**
 * SOC logical Workspace pick/add flow. Existing Workspaces retain the rc.2
 * picker menu, while creation asks only for a logical name. The authenticated
 * Host boundary maps that name into the user's private Workspace root; no
 * browser or native directory-picker implementation is mounted. The standard
 * directory-flow contract remains available for compatible contributors.
 */
import type { RefObject } from 'react';
import type { WorkspaceId, WorkspaceSnapshot, WorkspaceView } from 'dsh-soc-agent-workspace-controller/client';
import type { WorkspacePickerProps } from './contract/slots.ts';
/** Core flow props shared by the sidebar and conversation picker. */
export interface WorkspacePickFlowProps {
    /** The standard locale seat, forwarded by whichever slot entry hosts the flow. */
    t: WorkspacePickerProps['t'];
    /** Popover visibility (anchor button toggle state, owner-local). */
    open: boolean;
    /** The anchor button element — the popover's placement anchor. */
    anchorRef?: RefObject<HTMLElement | null> | undefined;
    /** Selector hook over the workspace list (framework standard hook). */
    useWorkspaces: <S>(selector: (state: WorkspaceSnapshot) => S) => S;
    /** Create a logical Workspace inside the authenticated user's private root. */
    createWorkspace: (input: {
        path: string;
    }) => Promise<WorkspaceView>;
    /** A real Workspace was picked or created. */
    onPick: (workspaceId: WorkspaceId) => void;
    /** Close the popover (outside click / Escape / post-pick). */
    onClose: () => void;
    /** Only offer the add action, hide existing workspaces. */
    addOnly?: boolean;
    /** Menu opening direction relative to the anchor. */
    side?: 'bottom' | 'top' | 'right';
    /** Currently active workspace (trailing check in the picker list). */
    selectedId?: WorkspaceId | undefined;
}
/** Render the rc.2 Workspace menu plus the SOC-owned logical-name dialog. */
export declare function WorkspacePickFlow({ t, open, anchorRef, useWorkspaces, createWorkspace, onPick, onClose, addOnly, side, selectedId, }: WorkspacePickFlowProps): import("react").JSX.Element;
/** Conversation empty-state registration around the shared SOC flow. */
export declare function WorkspacePicker({ open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, t, }: WorkspacePickerProps): import("react").JSX.Element;
