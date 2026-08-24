# @deepseek-ai/dsh-client-ui-workspace

English | [中文](README.zh.md)

Browser UI for logical chat folders and sessions. `WorkspaceBrowser` fills the sidebar's `sidebar.workspaces` slot, while `WorkspacePicker` fills the conversation hero's `conversation.hero.workspace` slot. The runtime keeps the historical Workspace-shaped client contract as an adapter, but the user-facing entity is a folder: it has a name and session membership, not a filesystem path.

The sidebar supports folder creation, rename, permanent folder deletion, grouped and flat session views, search, session rename/fork/archive, hover details, and status indicators. Creating a folder uses one name dialog; no directory-picker slot or native/browse plugin is required. A rejected create closes the name dialog before opening a retryable error dialog, and pending submission disables both click and Enter paths. Deleting a folder permanently deletes its member chat sessions and messages while leaving unrelated folders and sessions intact.

Search matches session titles and folder names immediately, then merges debounced Host content results. New queries cancel older requests; failures retain metadata matches with a warning. Results are capped at 20 and open the session without clearing the query.

The grouped view remembers expansion and browser-local order by folder id. The flat **In one list** view and **Last updated** or **Manual** ordering persist across reloads. Archive remains non-destructive: the session log stays durable while the row disappears from grouped, flat, and search surfaces; there is currently no unarchive UI.

Session rows preserve the existing fork, pending-interaction, running-descendant, clipboard, and accessibility behavior. Blank sessions remain hidden until their first accepted prompt. Subagent-origin sessions remain reachable through their parent rather than appearing as peer sidebar rows.

## Model Experience

None. This package is browser chrome and adds nothing to model requests.

## Known Limitations and Deferred Work

- Content search uses literal token or phrase matching and opens the session rather than the matching event.
- Archived sessions have no viewing or unarchive surface.
- Pending interaction state is not summarized on a collapsed folder header.
