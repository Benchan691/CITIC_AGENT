# 开发（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../DEVELOPMENT.md)

**本页读者:** 要改动本仓库的开发者。

**读完后你将了解:** 布局与工具链、工作区/依赖模型、权威源 vs 生成产物的边界、构建/运行/命令、补丁工作流、安全变更清单（含完整的 MCP 工具契约），以及 vendor 变更如何保持可复现。

**通俗概述。** 第一方代码刻意保持精悍：Node 宿主插件、一个 Python 包，以及独立 SOC workspace 中的 37 个包（包含 product bundle）和 26 个浏览器 package face。`vendor/deepseek-harness` 是冻结的纯净 rc.2 快照；SOC profile 通过 `apps/soc-agent/cordis.patch.yml` 和 SOC 自有替代包装配。大部分改动风险是*同步*风险：同一份工具清单现在只有一个来源（`tool-inventory.js`），由测试在两端钉住。

**前置要求:** [GETTING_STARTED.md](GETTING_STARTED.md)；文件地图见 [reference/REPOSITORY_MAP.md](../reference/REPOSITORY_MAP.md)。

---

## 1. 仓库布局（仅权威源码）

| 区域 | 路径 | 语言/工具 |
|---|---|---|
| Node 宿主插件 | `apps/soc-agent/*.js` | 纯 ESM，无框架，`node:test` |
| Python 服务器 | `apps/soc-agent/server/unified_mcp_server/` | Python ≥3.12，uv，pytest（asyncio auto） |
| SOC 浏览器包 | `packages/soc-agent-*/src/` | TypeScript + React + CSS modules，tsdown；必需 core/sidebar/workspace 加可选 feature 插件 |
| 技能 | `skills/<name>/SKILL.md` | 带 frontmatter 的 Markdown |
| 装配 | `apps/soc-agent/cordis.patch.yml` | YAML 补丁清单 |
| Vendor | `vendor/deepseek-harness/` | pnpm monorepo（勿编辑；见 §5） |

## 2. 工具链与命令

| 任务 | 命令（除注明外自仓库根） |
|---|---|
| 安装全部 / 修复装配 | `./setup.sh`（交互）或 `./setup.sh --plugins`（非交互） |
| Node 测试（宿主） | `pnpm --filter dsh-soc-agent test` |
| SOC 包测试 | `pnpm --filter dsh-soc-agent test && pnpm --filter 'dsh-soc-agent-*' test` |
| Python 测试（48） | `cd apps/soc-agent/server && uv sync --extra test && uv run pytest` |
| 重建 SOC workspace bundle | `pnpm run build`（或运行 `./setup.sh --plugins` 完成安装/构建/profile 装配） |
| 浏览器 smoke 与截图 | `pnpm exec vitest run --config apps/soc-agent/tests/vitest.browser.config.mjs` |
| 强制重建 harness | `./setup.sh --plugins --rebuild` |
| 启动应用 | 在仓库根运行 `vendor/deepseek-harness/node_modules/.bin/dsh web --no-open`（端口 3080） |
| 审计安装 | `./setup.sh --check` |

Lint/格式：**没有活跃的 formatter 或 hook** — `lefthook.yml` 全是注释示例，仓库根也没有 lint 配置。手动保持与周边风格一致。

## 3. 依赖 / 工作区模型

- 根 `pnpm-workspace.yaml` 拥有 SOC workspace；纯净 Harness 不包含本仓库，也不含 SOC 源码引用。运行时 SOC-to-SOC 依赖在 manifest 中使用精确版本，根 lockfile 为本地开发解析 workspace；profile 安装使用官方 `dsh plugin --profile web add` 机制直接加入本地包路径。
- 根 `package.json` 固定 `pnpm@11.7.0` 与 Node `^22.19.0 || >=24.0.0`。Harness 版本由 `vendor/deepseek-harness.upstream.json` 单独固定，并与 rc.2 新鲜 release archive 比对。
- Python extras：`markitdown-llm`（可选 OCR）、`test`（pytest）。
- 生成产物边界：所有 `packages/soc-agent-*/lib/` 产物都**被跟踪** — 修改源文件后重建所属包，并把声明、bundle 与源码一起提交（setup 也会自动修复漂移）。

## 4. 补丁工作流

1. **产品补丁**（`apps/soc-agent/cordis.patch.yml`）：切换/配置上游插件行或插入新的产品插件。以插件 id 标识；经 `dsh.bundle.patch` 消费。变更需重启宿主，并由 `skills.test.js`（名册断言）钉住。
2. **SOC 替代包**（`packages/soc-agent-*/`）：安全敏感 Harness 实现的独立 fork。每个 fork 都有 `UPSTREAM_BASELINE.json`，记录官方源路径、rc.2 commit 和源码 hash；不要改成 vendor-relative import。
3. **预设**（`apps/soc-agent/agent-presets/citic-soc/agent.cordis.yml`）：vendor 外的第一方 SOC 配置，通过产品补丁加载，可独立修改而不改变官方 release。

## 5. 保持 vendor 变更可复现

不要编辑 `vendor/deepseek-harness`。`tooling/verify-upstream.mjs --fresh` 会将跟踪的快照与官方 rc.2 release archive 比较，并拒绝 SOC 文件、生成产物和源漂移。改动应放在根 SOC workspace、产品装配或第一方 asset/config 目录；不要添加 vendor-relative link/import，未来 Harness 刷新会独立替换冻结快照。

## 6. 新增或修改工具 — 六合同步清单

一个 MCP 工具触及**六个契约**。漏一个，工具要么静默不出现，要么测试失败：

1. **清单** — 把名字（标签/kind）加入 `apps/soc-agent/tool-inventory.js` — 策略与桥接共同派生的单一来源。
2. **Python 注册** — 在对应 `register_tools` 模块（mail/filters/email）实现并从 `server.py create_server` 调用；读工具标 `readOnlyHint`；绝不暴露 `ctx`/`account_id`。
3. **原始允许列表** — 把原始名加入 `cordis.patch.yml` 的 `soc-agent-mcp.allowedToolNames`（补丁同时配置服务器环境）。
4. **限定名策略** — `policy.js` 现在从清单派生一切；除非改分类逻辑本身，这里无需再加。
5. **双端测试** — 扩展 `test_server_tools.py`（精确工具集）与 `policy.test.js`/`skills.test.js` 计数（当前 30 读 / 42 域 / 12 审批 — 它们会变，这正是目的）。
6. **文档** — 更新 [reference/MCP_TOOL_CATALOG.md](reference/MCP_TOOL_CATALOG.md)、[MCP_AND_TOOL_ROUTING.md](MCP_AND_TOOL_ROUTING.md) 与可追溯矩阵。

**Splunk 桥接**工具变更另需：`splunk-bridge.js` 从 `tool-inventory.js` 取名（外部服务器必须真的暴露它），并注意投影前缀 `mcp__splunk_mcp__splunk_` 自动生效。

**技能**：只加 `skills/<name>/SKILL.md`；若要列为可用，同步更新 `AGENTS.md` 并在审计记录差距（当前三个缺失技能的漂移就是前车之鉴）。

**策略/UI 变更**：`tool-inventory.js`/`policy.js` + `host.js` 门行为 + `AdminConsole`/`SocActionPolicyMenu` 标签 + `sections.test.ts` 文案护栏 + 文档。

## 7. Python 与 TypeScript 要点

- **Python:** 请求管线是 `execute()`（关联 id、预算、身份）→ 服务调用 → `success()/failure()` 信封。新增错误请扩展 `ServiceError` 代码分类而非自造形状；绝不让第三方异常文本到达用户。阻塞工作走 `run_blocking`（有界）。**Schema 变更**走新的 `migrations/NNN_*.sql`（advisory 锁、台账跟踪）— 绝不在 Node 或 Python 服务代码里写即兴 DDL。测试用内存替身与假传输 — 无需活服务。
- **TypeScript/React:** 可选 feature 通过 `dsh-soc-agent-client/client` 的 `SocClientRuntime` 使用 `/soc-agent-config`；设置页用 harness 设置 API + `expectedRevision`；CSS modules（`.module.css`）；每个 bundle 都是闭包工厂 — 不要在 setup 允许列表（react、react-dom、cordis、client-ui 原语/运行时、client store 或 SOC gateway client entry）之外添加裸 `require()`，否则 setup 会重建/拒绝。

## 仓库中的证据

- 根 `package.json`、各 SOC 包 manifest、`pyproject.toml` + pytest 配置、`setup.sh` 阶段注释、`vendor/deepseek-harness.upstream.json` 与 `skills.test.js`（装配/预设钉扎）。
