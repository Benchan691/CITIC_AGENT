# Diagrams

> **Verified against:** commit `b26d55d274cf298a456d84edfbcb42b8dc90134b` (branch `splunk-offical-mcp`, committed 2026-09-11T15:35:35Z) · documentation verified 2026-09-12.

Editable Mermaid sources for every diagram in the documentation set. Each diagram also exists as an accessible offline SVG under [`../site/assets/diagrams/`](../site/assets/) (with `<title>`/`<desc>` and a text alternative on the embedding page). The SVGs are simple generated renderings; the `.mmd` sources are the canonical editable form — re-render or regenerate them whenever the system changes.

| Source | Form | Shows | Embedded on |
|---|---|---|---|
| [system-context.mmd](system-context.mmd) | Context graph | People, system boundary, external services/stores | [../README.md](../README.md), [../ARCHITECTURE.md](../ARCHITECTURE.md) §1 |
| [runtime-containers.mmd](runtime-containers.mmd) | Architecture graph | Browser, Node host, Python children, bridge, stores | [../ARCHITECTURE.md](../ARCHITECTURE.md) §2 |
| [component-map.mmd](component-map.mmd) | Component/dependency graph | First-party modules, skills, patch seam, vendor, ownership | [../ARCHITECTURE.md](../ARCHITECTURE.md) §3 |
| [mcp-routing.mmd](mcp-routing.mmd) | Routing graph | Raw names, both servers, allowlists, policy gate, `ui__` entry, model/UI path | [../MCP_AND_TOOL_ROUTING.md](../MCP_AND_TOOL_ROUTING.md) §3 |
| [authentication-sequence.mmd](authentication-sequence.mmd) | Sequence diagram | Login, identity, metadata, denial paths, logout | [../RUNTIME_FLOWS.md](../RUNTIME_FLOWS.md) §3, [../AUTHENTICATION_AND_OWNERSHIP.md](../AUTHENTICATION_AND_OWNERSHIP.md) §2 |
| [action-authorization.mmd](action-authorization.mmd) | Decision tree | Allowlist → mode → per-tool state → approval → Python gates → email-specific confirmation | [../SECURITY_AND_TRUST_BOUNDARIES.md](../SECURITY_AND_TRUST_BOUNDARIES.md) §5, [../USER_INTERFACE_AND_ACTION_MODES.md](../USER_INTERFACE_AND_ACTION_MODES.md) §4 |
| [email-draft-send.mmd](email-draft-send.mmd) | State machine | Draft lifecycle incl. explicit Send gate and failure/retry | [../RUNTIME_FLOWS.md](../RUNTIME_FLOWS.md) §8, [../USER_INTERFACE_AND_ACTION_MODES.md](../USER_INTERFACE_AND_ACTION_MODES.md) §3 |
| [data-trust-boundaries.mmd](data-trust-boundaries.mmd) | Data-flow graph | Sensitive data classes, stores, sanitization/redaction points | [../SECURITY_AND_TRUST_BOUNDARIES.md](../SECURITY_AND_TRUST_BOUNDARIES.md) §1, [../DATA_AND_PERSISTENCE.md](../DATA_AND_PERSISTENCE.md) §1 |
| [configuration-precedence.mmd](configuration-precedence.mmd) | Decision/flow graph | Config sources, defaults, encrypted persistence, consumers | [../CONFIGURATION.md](../CONFIGURATION.md) §1 |
| [build-test-deploy.mmd](build-test-deploy.mmd) | Lifecycle graph | Sources → builds → tests → setup wiring → deployment → update path | [../DEPLOYMENT_AND_OPERATIONS.md](../DEPLOYMENT_AND_OPERATIONS.md) §3 |

Legend (consistent across all diagrams): rounded rectangles = people/actors; rectangles = processes/components; cylinder shapes = data stores; dotted arrows = human-only or optional paths; red-tinted nodes = sensitive data (see `data-trust-boundaries`). Names match [../reference/GLOSSARY.md](../reference/GLOSSARY.md) exactly.
