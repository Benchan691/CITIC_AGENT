# Agent Note: Wallpaper painting preserves UI stacking and surface lifetimes

Status: implemented

English | [中文](2026-08-21-wallpaper-painting-preserves-ui-stacking.zh.md)

## Problem

The wallpaper client painted two negative-z pseudo-elements inside a stacking context created on every active surface. A sidebar wallpaper therefore trapped its fixed Settings descendant below sibling columns, while session surfaces mounted after the wallpaper runtime's initial pass stayed unpainted because the DOM observer watched attribute edits but not added nodes. Surface registration used one map value per id, so disposing a later duplicate also erased the earlier registration. The settings card mirrored service changes through component-owned subscriptions, sent controlled range values only after Host round trips, exposed destructive controls as visually enabled in read-only sessions, and let crop offsets reveal blank output beyond the image.

## Decision

An active surface paints two CSS background layers directly on its host: a base-color gradient and the image. The runtime precomputes the gradient's composite shade from image opacity and scrim, so the result matches the former two-stage alpha composition without a pseudo-element, position override, z-index, or new stacking context. The observer includes child additions, tracks painted ids, and clears stale mutations when an element changes identity or the plugin unloads.

Surface registrations form a per-id stack; the latest label wins while disposing it reveals the preceding registration. The runtime publishes one stable observable snapshot for renderer-bound `useWallpaper`, stages writes optimistically, then either adopts the accepted Host snapshot or rolls back and reports rejection. Uploaded and replaced assets remain pending until an accepted settings snapshot proves they are either referenced or unused; deletion occurs only after the final surface reference disappears.

The card follows the Plugins page's disclosure shape, keeps surface inspection available in read-only sessions, rejects unsupported or oversized files before decoding, and exposes save failures. Crop geometry uses a fixed logical viewport projected responsively into the card. Every pan and zoom passes through one bounds function before preview or export, and pointer, keyboard, wheel, and native range input share that state.

## Verification

The wallpaper runtime specs mount a configured surface after startup, change and remove its surface id, dispose duplicate registrations, reject an optimistic write, clear a shared image one surface at a time, and dispose the plugin while painted. Component specs pin the collapsed disclosure, read-only surface browsing, early file-size rejection, and visible save failure. Crop helper specs pin pan and zoom bounds. The package TypeScript build, browser bundle, and focused 18-test suite pass; the assembled browser check covers the sidebar, fixed Settings overlay, and late-mounted conversation surface. The repository-wide GUI and Web replay lanes remain separate gates rather than claims of this focused verification.

## Alternatives considered

**Keep pseudo-elements and raise every child above them.** Rejected because it requires position and z-index rules on arbitrary descendants, overrides sticky and fixed behavior, and makes each new surface responsible for a stacking contract unrelated to wallpaper.

**Keep attribute-only DOM observation and ask every surface plugin to trigger repaint.** Rejected because mounting is already the observable fact; duplicating repaint calls across layout, sidebar, and conversation owners leaves dynamically contributed surfaces fragile.

**Debounce controls only inside the React component.** Rejected because every caller of the service would retain delayed, non-optimistic writes and asset cleanup races. The settings scope already serializes Host mutations, so the runtime only owns immediate projection and final reconciliation.

## Consequences

Wallpapers do not alter positioning or stacking, late-mounted session content paints automatically, and HMR disposal restores duplicate registrations and cleans DOM state. Controls respond immediately and failed persistence restores durable values with an error. Crop output cannot contain blank edge strips and remains usable on narrow cards and without a pointer. Asset cleanup adds best-effort DELETE requests after accepted settings changes; a failed DELETE can leave an unreferenced file on disk, but never removes an image still referenced by another surface.
