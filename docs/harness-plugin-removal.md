# Harness plugin removal

The cleanup is limited to the SOC product in this repository. Each stage removes
package source and generated artifacts, updates retained build and dependency
references, and verifies the remaining application before advancing.

## Stage 1: unused providers

Remove these four packages, which are outside the SOC application's runtime
dependency chain:

- `@deepseek-ai/dsh-e2b`
- `@deepseek-ai/dsh-fs-e2b`
- `@deepseek-ai/dsh-subprocess-e2b`
- `@deepseek-ai/dsh-session-title-all-prompts-llm`

Remove their build entries, package lists, E2B workflow, obsolete workflow tests,
and generated API references. Refresh the workspace lockfile. Keep the
deterministic session-title service and local filesystem provider used to load
agent instructions.

Status: completed on 2026-10-08. All four packages and the E2B workflow are
removed. The refreshed lockfile drops the E2B SDK and its now-unused dependencies;
dependency synchronization removed 20 installed dependency entries. The obsolete
E2B service entry was removed from the generated runtime API catalog without
altering the retained entries.

## Stage 2: optional coding integrations

Remove the following packages after updating their tool-catalog, preset,
documentation, and test references:

- `@deepseek-ai/dsh-lsp`, `@deepseek-ai/dsh-lsp-stdio`, `@deepseek-ai/dsh-tool-lsp`
- `@deepseek-ai/dsh-experimental-agent-team`, `@deepseek-ai/dsh-experimental-tool-agent-team`
- `@deepseek-ai/dsh-subagent-codex`, `@deepseek-ai/dsh-subagent-claude-code`, `@deepseek-ai/dsh-subagent-dsh-sdk`
- `@deepseek-ai/dsh-tool-terminal`

Status: planned; no stage 2 packages removed.

## Stage 3: disabled bundle plugins

Remove these plugins and their entries in the base or web bundle manifests and
patches:

- `@deepseek-ai/dsh-session-telemetry-otel`
- `@deepseek-ai/dsh-session-title-first-prompt-llm`
- `@deepseek-ai/dsh-client-ui-trajectory`

Retain shared service definitions whenever another runtime or build consumer
uses them. Removing entire shell, filesystem, jobs, goals, or subagent families
is outside this three-stage cleanup.

Status: planned; no stage 3 packages removed.

## Validation

For stage 1, require a synchronized workspace lockfile, a complete harness and
web build, focused checks for retained session titles and filesystem providers,
SOC application tests, and the SOC browser composition test. Browser checks use
fixtures and do not access customer systems or send email.

Authentication, user ownership, Splunk and Zimbra MCP, approvals, session
persistence, skills, context compaction, and SOC browser features remain required
through all three stages.

### Stage 1 results

- Complete harness build: passed, including host/client TypeScript projects,
  package bundles, and the web frontend.
- SOC application tests: 46 passed.
- Focused harness tests: 234 passed, 1 skipped across 17 test files. These cover
  session titles, retained filesystem providers, build configuration, and CI
  workflow configuration.
- SOC browser composition: 1 passed with fixture authentication and workspace
  data.
- Lint for changed TypeScript files: passed.
- Configuration-source ownership check and diff whitespace check: passed.
- Source, dependency, lockfile, and directory audit: no retained active
  references to the removed packages. Historical architecture notes retain their
  original descriptions.
- The SOC patch, policy, authentication, ownership, Splunk bridge, and base/web
  composition patches match the pre-removal versions.

### Existing repository check limitations

These wider checks do not pass in the existing vendored checkout:

- Full API-catalog regeneration is blocked by missing JSDoc on the retained MCP,
  session-folder, session-persistence, and workspace-cleanup contracts. A targeted
  TypeScript syntax-tree update removed only the obsolete generated E2B service
  entry. The retained MCP source remains unchanged.
- The README model-experience check requires `docs/tool-catalog.md`, which is
  absent from the baseline checkout.
- README limitations and package invariant checks report missing documentation
  or invariant contracts in the retained `session-folders` and
  `workspace-session-cleanup` packages. Their source is unchanged.
- The four edited English/Chinese README pairs already have mismatches in links
  to upstream documentation absent from the checkout. The pairing records were
  refreshed, and comparison with the original documents confirms no new
  structural mismatches from this removal.

Stage 2 and stage 3 remain planned; this change does not execute them.
