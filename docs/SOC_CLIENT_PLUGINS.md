# SOC client plugins

> **Verified against:** commit `56c8dd2` and the current checked-in browser artifacts.

The SOC browser surface is split into independent first-party plugins. The
official Harness sidebar and workspace implementations remain in the frozen
vendor tree, but the SOC profile disables them and enables the isolated
replacements. This keeps the current appearance and host-facing slot names
while allowing optional SOC features to be disabled one at a time.

## Package matrix

| Package | Configuration row | Default | Owns |
|---|---|---:|---|
| `dsh-soc-agent-client` | `soc-agent-client-core` | required | Authentication gate, `socClient` runtime, action-policy schema, `/admin` root and safe fallback |
| `dsh-soc-agent-sidebar` | `soc-agent-sidebar-ui` | required | Isolated standard `sidebar` slot, expanded/collapsed layout, child-slot contracts |
| `dsh-soc-agent-workspace` | `soc-agent-workspace-ui` | required | Workspace/session browser, picker, search, grouping, reordering, rename/fork/archive/delete, and the reversible `api.folders` guard |
| `dsh-soc-agent-brand` | `soc-agent-brand-ui` | enabled | CITIC/Sentinel sidebar and conversation branding |
| `dsh-soc-agent-admin` | `soc-agent-admin-ui` | enabled | The four-page `/admin` console and its settings UI |
| `dsh-soc-agent-action-policy` | `soc-agent-action-policy-ui` | enabled | End-user Full access/SOC mode selector |
| `dsh-soc-agent-attachments` | `soc-agent-attachments-ui` | enabled | MarkItDown provider, document rail, file command, settings card, and attachment schema |
| `dsh-soc-agent-email-draft` | `soc-agent-email-draft-ui` | enabled | Editable Zimbra send/forward/signature tool views |
| `dsh-soc-agent-auto-collapse` | `soc-agent-auto-collapse` | enabled | Contract-based compact transcript behavior and draft-card preservation |

The six feature rows are optional. The core, isolated sidebar, and isolated
workspace are mandatory. The repository contains 37 SOC packages including
the product bundle, with 26 browser-facing package faces. Every package is
installed and built even when an optional row is disabled, so enabling a
feature is a profile configuration change rather than a build or dependency
change.

## Shared runtime contract

Optional browser plugins depend on `dsh-soc-agent-client` and inject its
Cordis service. The public client declaration is
`dsh-soc-agent-client/client`:

```ts
interface SocClientRuntime {
  readonly surface: 'workspace' | 'admin'
  rpc<T>(name: string, payload?: Record<string, unknown>): Promise<T>
}
```

The core sends these calls through the authenticated `/soc-agent-config`
channel. It selects the `admin` surface only for `/admin` and `/admin/*`.
The core owns the `/admin` root takeover and declares `soc.admin.content`.
When the admin feature is disabled, that slot renders a safe
“Administration UI is disabled” page; the normal workspace cannot appear at
the administration route.

The action-approval settings schema remains in the mandatory core because
host-side policy and administration controls must remain present even when
the end-user selector is disabled. The attachment settings schema belongs to
the attachment plugin; disabling it removes the feature without deleting
stored preferences.

## Selective configuration

Edit `apps/soc-agent/cordis.patch.yml` and set one feature row to
`disabled: true`, for example:

```yaml
- id: soc-agent-attachments-ui
  disabled: true
```

The other feature rows remain independent. The composition tests verify that
disabling each row leaves the core, isolated sidebar, and isolated workspace
active. The source/manifest isolation test recursively checks every
first-party production file for imports of the official sidebar/workspace
packages.

## Build, setup, and verification

From the repository root, build an individual package with:

```bash
pnpm --filter dsh-soc-agent-client run bundle
pnpm --filter dsh-soc-agent-sidebar run bundle
pnpm --filter dsh-soc-agent-workspace run bundle
pnpm --filter dsh-soc-agent-brand run bundle
pnpm --filter dsh-soc-agent-admin run bundle
pnpm --filter dsh-soc-agent-action-policy run bundle
pnpm --filter dsh-soc-agent-attachments run bundle
pnpm --filter dsh-soc-agent-email-draft run bundle
pnpm --filter dsh-soc-agent-auto-collapse run bundle
```

`pnpm run build` emits declarations and bundles the complete independent SOC
workspace. `./setup.sh --plugins` uses one authoritative matrix for all 37
packages and their 26 browser faces. It installs dependencies, builds the
pristine Harness and the SOC workspace, repairs bundle artifacts when
required, fingerprints source inputs, registers every package in the web
profile, resolves each package, and checks browser-safe external requires.
`./setup.sh --check` audits the same artifact and profile set without changing
it.

The browser smoke lane is run from the repository root:

```bash
pnpm exec vitest run --config apps/soc-agent/tests/vitest.browser.config.mjs
```

It loads the real bundles in fixture mode, intercepts only authentication,
checks the isolated sidebar/workspace and conversation picker, captures
expanded/collapsed/list/picker screenshots, rejects browser errors and failed
resources, and asserts that official sidebar/workspace bundles were not
requested.

## Snapshot provenance and rollback

The isolated sidebar and workspace are pinned visual snapshots of the
checked-in UI at `56c8dd2`. Their source hashes are recorded in:

- `packages/soc-agent-sidebar/snapshot-baseline.json`
- `packages/soc-agent-workspace/snapshot-baseline.json`
- `apps/soc-agent/tests/__screenshots__/`

Future Harness styling changes are adopted only through an explicit source,
hash, and screenshot update. The official source under
`vendor/deepseek-harness/packages/client/ui-sidebar` and
`vendor/deepseek-harness/packages/client/ui-workspace` stays untouched.

Rollback is configuration-only: disable the SOC sidebar/workspace rows and
re-enable the official `ui-sidebar` and `ui-workspace` rows, then restart the
web app. No backend route or persisted workspace/session schema is changed by
this split.
