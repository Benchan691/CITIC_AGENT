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

Status: completed on 2026-10-08. All nine packages and their local build artifacts
are removed. Retained package manifests have no dependencies on these packages.
The lockfile drops 22 dependency versions, including the Codex CLI, Claude Agent
SDK, and language-server libraries; 10 orphan installed dependency folders were
also removed. Optional product-provider rows and their authoring guidance were
removed from the shipped presets. Shared terminal services, persistent shell
tools, and the in-process and ACP subagent providers remain.

## Stage 3: disabled bundle plugins

Remove these plugins and their entries in the base or web bundle manifests and
patches:

- `@deepseek-ai/dsh-session-telemetry-otel`
- `@deepseek-ai/dsh-session-title-first-prompt-llm`
- `@deepseek-ai/dsh-client-ui-trajectory`

Retain shared service definitions whenever another runtime or build consumer
uses them. Removing entire shell, filesystem, jobs, goals, or subagent families
is outside this three-stage cleanup.

Status: completed on 2026-10-08. All three packages and their local build
artifacts are removed. The base and web bundle manifests and composition
patches no longer reference them, and the SOC patch no longer needs disable
overrides for them. The lockfile drops 13 unused dependency versions, including
the OTLP exporter stack and trajectory virtualization libraries; their 13
orphan installed folders were also removed.

The deterministic session-title provider, shared session telemetry and feedback
contracts, and generic conversation extension slots remain. Feedback records
are local without an exporter. The CLI's exporter-specific boot switch and its
obsolete test were removed. Compatibility opt-out environment variables in
upstream release/CI scripts remain harmless when used with older binaries.

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
  TypeScript syntax-tree update removed the obsolete E2B service in stage 1 and
  the two LSP/team services plus 25 associated types in stage 2. All retained
  generated catalog entries match their pre-removal versions. The retained MCP
  source remains unchanged.
- The README model-experience check requires `docs/tool-catalog.md`, which is
  absent from the baseline checkout.
- README limitations and package invariant checks report missing documentation
  or invariant contracts in the retained `session-folders` and
  `workspace-session-cleanup` packages. Their source is unchanged.
- The four edited English/Chinese README pairs already have mismatches in links
  to upstream documentation absent from the checkout. The pairing records were
  refreshed, and comparison with the original documents confirms no new
  structural mismatches from this removal.

### Stage 2 results

- Complete harness and web build: passed.
- SOC application tests: 46 passed; SOC browser composition: 1 passed with
  fixture authentication and workspace data.
- Focused harness tests: 610 passed, 3 skipped across 34 files, covering the
  retained terminal services, persistent shell tools, subagent services, base
  bundle, catalogs, and build/CI configuration.
- Additional job-control and gate tests: 159 passed across 4 files. Job notice
  fixtures now use the retained subagent kind instead of the removed PTY-tool
  kind, preserving the bounded-output and collection-action assertions.
- Shipped web preset composition tests: 29 passed.
- Lint for all 12 changed TypeScript files, package-path validation,
  configuration-source ownership, and diff whitespace checks: passed.
- Dependency and source audit: no retained active imports or compositions
  require the removed packages. Historical architecture notes and durable
  replay recordings retain their original descriptions; negative regression
  tests continue to assert that removed providers are absent.
- The SOC patch, policy, authentication, ownership, Splunk bridge, and base/web
  composition patches match the pre-removal versions.
- All eight changed English/Chinese pairing records were refreshed. Three
  pairs retain existing missing-upstream-document link mismatches; comparison
  with the original documents confirms no new structural mismatches.
- The type-equivalence documentation gate also cannot pass because the
  baseline vendored checkout omits its upstream `docs/` tree. The 14 manifest
  entries for removed LSP/team source types were deleted; retained entries
  remain unchanged.

### Stage 3 results

- Complete harness and web build: passed.
- SOC application tests: 46 passed; SOC browser composition: 1 passed with
  fixture authentication and workspace data.
- Shipped web preset composition tests: 29 passed.
- Feedback and retained navigation browser fixtures: refreshed, then replayed
  successfully (8 passed, 1 live-recording test skipped). The feedback snapshot
  now states that session sharing is not configured; the remaining single chat
  view, search, export, and terminal-card checks pass without a model API.
- Focused harness suite: 872 passed, 4 failed across 67 files. All four failures
  reproduce before stage 3: two legacy workspace-button assertions, one
  prompt mock argument mismatch, and the client catalog's two undocumented
  workspace slots. The changed package removals introduce no new failures in
  that suite.
- Client catalog regeneration remains blocked by missing JSDoc on
  `conversation.hero.workspace.directoryFlow` and
  `sidebar.workspaces.directoryFlow`. Only the conversation-view description
  and the removed trajectory occupant were updated in the generated catalog;
  all other entries remain unchanged.
- Lint for all 14 changed TypeScript files, package-path validation,
  configuration-source ownership, and diff whitespace: passed.
- All nine changed English/Chinese pairing records were refreshed. Four pairs
  retain existing missing-upstream-document link mismatches; comparison with
  the original documents confirms no new structural mismatches.
- Authentication, policy, user ownership, and Splunk bridge source match the
  pre-removal versions. The SOC composition patch only loses the three obsolete
  disable overrides.

All three stages are complete: 16 optional plugin packages have been removed.
