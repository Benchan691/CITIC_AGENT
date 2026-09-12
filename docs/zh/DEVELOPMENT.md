# 开发（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../DEVELOPMENT.md)

**本页读者:** 要改动本仓库的开发者。

**读完后你将了解:** 布局与工具链、工作区/依赖模型、权威源 vs 生成产物的边界、构建/运行/命令、补丁工作流、安全变更清单（含完整的 MCP 工具契约），以及 vendor 变更如何保持可复现。

**通俗概述。** 第一方代码刻意保持精悍：五个 Node 插件文件加两个共享模块、一个 Python 包、一个客户端包。vendored harness 只通过 `cordis.patch.yml` 配置 — 从不编辑；唯一的文件级 vendor 补丁带清单。大部分改动风险是*同步*风险：同一份工具清单现在只有一个来源（`tool-inventory.js`），由测试在两端钉住。

**前置要求:** [GETTING_STARTED.md](GETTING_STARTED.md)；文件地图见 [reference/REPOSITORY_MAP.md](../reference/REPOSITORY_MAP.md)。

---

## 1. 仓库布局（仅权威源码）

| 区域 | 路径 | 语言/工具 |
|---|---|---|
| Node 宿主插件 | `apps/soc-agent/*.js` | 纯 ESM，无框架，`node:test` |
| Python 服务器 | `apps/soc-agent/server/unified_mcp_server/` | Python ≥3.12，uv，pytest（asyncio auto） |
| 客户端 | `packages/soc-agent-client/src/` | TypeScript + React + CSS modules，tsdown |
| 技能 | `skills/<name>/SKILL.md` | 带 frontmatter 的 Markdown |
| 装配 | `apps/soc-agent/cordis.patch.yml` | YAML 补丁清单 |
| Vendor | `vendor/deepseek-harness/` | pnpm monorepo（勿编辑；见 §5） |

## 2. 工具链与命令

| 任务 | 命令（除注明外自仓库根） |
|---|---|
| 安装全部 / 修复装配 | `./setup.sh`（交互）或 `./setup.sh --plugins`（非交互） |
| Node 测试（宿主，35） | `cd apps/soc-agent && npm test`（= `node --test tests/*.test.js`） |
| 客户端测试（12） | `cd packages/soc-agent-client && npm test`（vendored tsx 加载器） |
| Python 测试（39） | `cd apps/soc-agent/server && uv sync --extra test && uv run pytest` |
| 重建客户端 bundle | `pnpm --filter dsh-soc-agent-client run build`（重新生成被跟踪的 `lib/`） |
| 强制重建 harness | `./setup.sh --plugins --rebuild` |
| 启动应用 | `cd vendor/deepseek-harness && pnpm dsh web --no-open`（端口 3080） |
| 审计安装 | `./setup.sh --check` |

Lint/格式：**没有活跃的 formatter 或 hook** — `lefthook.yml` 全是注释示例，仓库根也没有 lint 配置。手动保持与周边风格一致。

## 3. 依赖 / 工作区模型

- vendored harness 的 `pnpm-workspace.yaml` **包含本仓库**（`../../apps/*`、`../../packages/*`）— SOC 包是工作区成员，经 `workspace:*`（`dsh-soc-agent` → `dsh-soc-agent-client`、`dsh-agent-instructions`、`dsh-llm`、`schemastery`）和一个 `link:`（`@deepseek-ai/dsh-mcp-client`）解析。
- 两个 Python 依赖声明**各有其职**：根 `requirements.txt` 是 harness profile 的 *外部 pnpm 插件* 清单（不是 Python！），服务器的 `pyproject.toml`/`uv.lock` 才是真正的 Python 依赖。`setup.sh` 以硬编码 `PLUGIN_NAMES` 对两个 spec 做数量校验 — 加插件必须同时改两个文件。
- Python extras：`markitdown-llm`（可选 OCR）、`test`（pytest）。
- 生成产物边界：`packages/soc-agent-client/lib/` **被跟踪** — 客户端改动后务必重建，并把源码与 bundle 一起提交（setup 也会自动修复漂移）。

## 4. 补丁工作流

1. **产品补丁**（`apps/soc-agent/cordis.patch.yml`）：切换/配置上游插件行或插入新的产品插件。以插件 id 标识；经 `dsh.bundle.patch` 消费。变更需重启宿主，并由 `skills.test.js`（名册断言）钉住。
2. **Vendor 文件补丁**（`patches/dsh-auto-collapse@0.1.4.patch`）：对上游插件*构建产物*的 pnpm 补丁。由 setup 复制到 `~/.dsh/profiles/web/patches/`（与仓库副本逐字节比较；不一致即拒绝）。`requirements.txt` 中的提交钉扎（`#cd21c04…`）**因为**补丁针对 0.1.4 — 升级时两者一起改。
3. **预设**（`vendor/.../agent-presets/citic-soc/agent.cordis.yml`）：vendor 内的本地配置，被 `skills.test.js` 断言。修改它是 vendor 树变更 — 见 §5。

## 5. 保持 vendor 变更可复现

不要编辑 `vendor/deepseek-harness` 源码。可接受的 vendor 树工件，全部可从第一方文件复现：`citic-soc` 预设（有文档、有测试）、pnpm `overrides`（vendor 根已有 schemastery/cosmokit）、setup 写入的 profile 补丁副本。其他需求应变成 (a) `cordis.patch.yml` 行、(b) `patches/*.patch` 文件、或 (c) 上游贡献。

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
- **TypeScript/React:** 组件经 `settings-common.rpc` 读取 `/soc-agent-config` 通道；设置页用 harness 设置 API + `expectedRevision`；CSS modules（`.module.css`）；bundle 是闭包工厂 — 不要在 setup 允许列表（react、react-dom、cordis、client-ui 原语/运行时）之外添加裸 `require()`，否则 setup 会重建/拒绝。

## 仓库中的证据

- 两个 `package.json` 的 scripts、`pyproject.toml` + pytest 配置、`setup.sh` 阶段注释（含 schemastery `lib/` 前置与 SOC 漂移修复）、`requirements.txt` 头注释、`skills.test.js`（补丁/预设钉扎）。
