# Agent Note: Compact CITIC SOC folders and runtime composition

Status: implemented

English | [中文](2026-08-21-compact-citic-soc-folders.zh.md)

## Problem

The product composition still treated a filesystem directory picker as mandatory even though the CITIC SOC workflow groups investigations with logical folders. Removing the picker left the API gateway pending, which turned every `/api/*` request into a 404 and caused the browser to reconnect indefinitely. Folder-mode refresh also discarded the independent archive baseline, seeded replay sessions missed the startup folder migration, initial selection could recursively reopen a persisted session, and the standard replay preset had been changed into a tool-disabled SOC persona that made unrelated interaction replays time out.

## Decision

The product defaults to a dedicated `citic-soc` preset containing only the SOC persona, instructions, investigation skill, compaction, command, pruning, and ask-user capabilities. The standard coding preset remains the stable replay fixture. The web composition removes directory-picker UI and its unused dependencies.

The API gateway no longer injects the directory picker as a startup requirement. Legacy directory endpoints discover it at request time and return `directory-picker-unavailable` when absent, while all other APIs remain active. Folder refresh adapts `folder.list` into the existing client projection and concurrently requests `workspace.list` solely for its registry-global archive snapshot. Choosing a logical folder for the current blank session moves it in place; mutable folder membership takes precedence over its creation-time header, and a navigation generation prevents an older New Session request from replacing a newer folder choice. Initial selection completes its startup state before opening a persisted session. Replay setup assigns newly seeded sessions to General after persistence so the test mirrors a post-startup import, and it asserts that composition entries activate rather than merely load.

## Verification

The CLI preset catalog, Cordis configuration validation, focused client runtime and API gateway tests, wallpaper and folder UI tests, library builds, and TypeScript builds pass. The long-interaction, scroll-contract, navigation-pane, and rewritten logical-folder workspace replays pass, including the optional-folder composer regression, duplicate folder feedback, rename/delete, flat-view persistence, archive restoration, and a clean no-model-call run.

## Alternatives considered

**Keep the directory picker mounted but hide its controls.** Rejected because it preserves filesystem authority and dependencies in a product that does not use them, and it leaves gateway startup coupled to an optional compatibility feature.

**Replace the standard preset with the SOC preset.** Rejected because replay tests deliberately exercise general coding tools and renderer contracts. A product default and a test fixture serve different purposes and should be named separately.

**Derive archives from the folder response.** Rejected because folder membership and the global archive set have different owners and lifetimes. Parallel baselines preserve both without expanding the folder schema.

## Consequences

The CITIC SOC surface starts with a smaller capability set and no directory browser, while legacy hosts can still supply the optional picker endpoints. Logical folders remain compatible with the existing Workspace-shaped renderer contract, archives survive reloads in folder mode, seeded investigations appear immediately, and replay failures identify inactive composition entries instead of degrading into WebSocket timeouts.
