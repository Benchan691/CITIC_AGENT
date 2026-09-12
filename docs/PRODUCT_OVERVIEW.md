# Product overview

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

**Who this page is for:** everyone — especially non-developers evaluating or onboarding onto the system.

**What you will understand:** the business problem, the intended users, the supported workflows, what the product deliberately does **not** do, and the safety philosophy that shapes every design decision.

**Plain-language summary.** SOC analysts spend their day pivoting between a mailbox full of phishing reports and a Splunk full of security events. The SOC Agent puts both behind one chat: the analyst signs in as themselves, asks for an investigation in plain language, and the agent queries Splunk (read-only) and the analyst's mailbox through a small, explicitly approved tool set. Evidence comes back sanitized and bounded. When action is needed — moving a phishing mail, creating a mailbox rule, drafting a takedown email — the agent proposes it, the analyst approves it, and the system enforces that approval on the server. Emails are only ever sent by a human clicking **Send** in a draft view.

**Prerequisites:** none.

---

## 1. The business problem

Customer security investigations require correlating evidence across systems that never talk to each other: report emails in Zimbra, detection alerts and raw telemetry in Splunk, and subscription/contact records in an internal service. Doing this by hand is slow and error-prone; doing it with an unconstrained AI would be unsafe. This product is the constrained middle ground: an AI agent with exactly enough tooling to investigate, and hard boundaries that keep it from doing anything a human has not approved.

## 2. Intended users

| User | Authenticates with | Can do |
|---|---|---|
| **SOC analyst** | Their own Zimbra email + password | Investigate Splunk, search/read their own mailbox, create email drafts, propose mutations (approval-gated), use skills |
| **Administrator** | Static `SOC_ADMIN_EMAIL`/`SOC_ADMIN_PASSWORD` | Configure access modes and per-tool approvals, view service status, manage agent context (BACKGROUND.md cadence), configure AI providers (write-only credentials) |

One person can be both, with separate sessions (different cookies, different stores — admin sessions are in-memory, 8 h; analyst sessions are Postgres-backed, 24 h).

## 3. Supported workflows

1. **Splunk investigation** (skill `splunk-investigation`): ask about an IP, host, user, alert, or timeline; the agent runs bounded, read-only queries through `mcp__splunk_mcp__*` tools and reports evidence with confidence and limitations.
2. **Email triage** (mailbox tools): list folders, search, read messages/headers, extract attachment text (MarkItDown) — always the signed-in user's own mailbox.
3. **Email + Splunk correlation**: read a reported phishing email, then pivot its indicators into Splunk searches.
4. **False-positive analysis** (skill `false-positive-analysis`): explain why an alert fired, classify malicious/benign/inconclusive, propose the narrowest safe tuning.
5. **Detection engineering** (skills `detection-engineering`, `spl-writing`): inspect existing rules, compile CITIC production SPL, validate, backtest safely — then hand a **disabled** definition to the external human Splunk deployment process. The application never deploys.
6. **Mailbox mutations** (approval-gated): move mail, create folders, manage signatures, create/update/reorder filters (with fingerprint-based optimistic concurrency).
7. **Email drafting and sending**: the agent drafts; the analyst edits and sends in the draft view.
8. **Subscription management** (approval-gated): list/preview/create/update/delete email subscriptions on the subscription service.

## 4. Non-goals (deliberate, verified in code)

- **No autonomous monitoring.** The agent operates on request only (`AGENTS.md`: no polling, no watching).
- **No Splunk mutation.** There is no create/update/enable/disable/delete tool for alerts or detections — the bridge allowlist contains only read tools, and the retained in-process Splunk implementation is not registered (`test_server_tools.py`).
- **No detection deployment.** Even the detection workflow's output is an `enabled: false` definition handed to a human process (`detection.py` hard-requires `enabled: false`).
- **No model-driven email delivery.** `zimbra_send_email` builds a local draft; only the UI's Send confirmation triggers delivery.
- **No stored mailbox credentials.** The legacy account store is neutered at runtime (`EmptyAccountStore`); the agent uses the authenticated user's own session token.
- **No shell, filesystem, or coding tools for the model.** The cordis patch disables those plugin families; the model can only use the allowlisted SOC tools.
- **No cross-customer data handling.** `AGENTS.md` forbids exposing one customer's data to another; identity is always the authenticated user's.

## 5. Terminology

See [reference/GLOSSARY.md](reference/GLOSSARY.md) for the full vocabulary (MCP, SPL, cordis, action modes, retained code, …). The short version: **`soc_agent`** is the local Zimbra/subscription tool server; **`splunk_mcp`** is the read-only Splunk tool namespace served by an external endpoint; **Full access / SOC mode** control whether approved tools run directly or honor per-tool ask/auto/disabled settings.

## 6. Major capabilities at a glance

| Capability | Where |
|---|---|
| Chat UI with attachments, approvals, action-mode menu | `packages/soc-agent-client` |
| 27 domain tools (Zimbra 21, subscriptions 6) | `apps/soc-agent/server/unified_mcp_server/` |
| 13 read-only Splunk tools (external endpoint) | `apps/soc-agent/splunk-bridge.js` |
| Authentication, ownership isolation, event redaction | `apps/soc-agent/auth-host.js`, `ownership.js` |
| Tool allowlist + action policy | `apps/soc-agent/policy.js`, `host.js` |
| Admin console (status, context, approvals, providers) | `AdminConsole.tsx` served at `/admin` |
| Skills (playbooks) | `skills/*/SKILL.md` |
| Setup/update tooling | `setup.sh`, `update.sh` |

## 7. Safety philosophy (and where it is enforced)

1. **Allowlist, then classify.** A tool must be registered by the patch allowlist *and* pass the host policy; unknown names are denied (`host.js tools/pre-execute`).
2. **Server-side identity.** Every request carries server-validated identity; prompts and retrieved content cannot change who you are.
3. **Approvals at two layers.** MCP-side gates (e.g. `ZIMBRA_ALLOW_SEND`, filter fingerprints) and UI-side approval states must both agree; either can say no.
4. **Human sends email.** The only delivery path requires an authenticated session, the send gate, an explicit UI confirmation, and Zimbra's own `sent: true` acknowledgment.
5. **Bounded everything.** Time budgets (180 s), output caps (50 KB Splunk projection, 64 KiB background, attachment char/byte limits), and thread-pool quotas.
6. **Evidence, not instructions.** Mail and Splunk content is data; `AGENTS.md` instructs the model accordingly, and the system never treats retrieved content as authorization.

Details and residual risks: [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md).

## 8. Current capability vs historical material

- **Current:** everything listed above at the verified commit.
- **Historical/retained:** the in-process Splunk implementation (`unified_mcp_server/splunk/`) — fully built, tested, not registered; the legacy stored-account feature (refused by the admin CLI and neutered at runtime); the removed `integrations/` directory (replaced by the bridge approach).
- **Aspirational drift:** `AGENTS.md` names three skills (`soc-incident-triage`, `email-to-splunk-investigation`, `zimbra-operations`) that have no files in `skills/` at this commit. See [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md).

## Evidence in the repository

- Workflows and boundaries: root `AGENTS.md`, `BACKGROUND.md`, `skills/*/SKILL.md`
- Enforcement: `apps/soc-agent/policy.js`, `host.js`, `splunk-bridge.js`, `unified_mcp_server/server.py`
- Non-goals: `test_server_tools.py` (no Splunk tools), `admin_cli.py` (refusals), `cordis.patch.yml` (disabled tool families)

## Unknowns

- The external official Splunk MCP server's exact guardrails are defined outside this repository (the local docs describe only how this repo consumes it).
- The subscription service's data model is defined by its API responses (`get_subscription_schema`), not by this repo.
