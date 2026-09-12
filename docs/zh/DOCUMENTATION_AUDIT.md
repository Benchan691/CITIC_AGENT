# 文档审计（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（分支 `splunk-offical-mcp`，2026-09-12T15:22:44+08:00 = 2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12（第二轮；本轮新增中文本地化）。
> 本页记录实际做了什么、无法做什么、以及仍不确定的事项。除非有输出确认，这里绝不声称"通过"。

**核对轮次。** 第一轮以 `b26d55d274cf298a456d84edfbcb42b8dc90134b`（2026-09-11T15:35:35Z）核对英文文档集。第二轮（本页）在维护者的四个重构提交（`d264ca7`、`576c7c9`、`aac5cda`、`56c8dd2` — Splunk 栈移除、转发功能等）之后对 `56c8dd2` 全量重核，并新增中文本地化（`docs/zh/` 与 `docs/site/zh/`）。维护者自己的实施报告是 [SHORTENING_PLAN_IMPLEMENTATION.md](../SHORTENING_PLAN_IMPLEMENTATION.md)（基线 `d264ca7`）。

---

## 1. 基线

- 仓库根: 含本 `docs/` 树的 CITIC_AGENT Git checkout（刻意不记录绝对路径）。
- 提交: `56c8dd21492a5c36cb9f3eaa3da01160aba40033`；分支 `splunk-offical-mcp`，核对时工作树干净。
- 指令源: 根 `AGENTS.md`（唯一的第一方 `AGENTS.md`）与执行简报 `docs/GLM_5_3_REPOSITORY_DOCUMENTATION_INSTRUCTIONS.md`。

## 2. 两轮之间代码的变更（及文档如何跟进）

| 变更 | 文档影响 |
|---|---|
| **Python Splunk 栈删除**（34 文件 `splunk/**`、`splunk_service.py`、`detection.py`、12 个测试文件） | "保留"全部改标 **已移除**（[REPOSITORY_MAP](../reference/REPOSITORY_MAP.md)、[COMPONENT_CATALOG](../reference/COMPONENT_CATALOG.md) §13、[MCP_TOOL_CATALOG](../reference/MCP_TOOL_CATALOG.md) §7、[TRACEABILITY_MATRIX](../reference/TRACEABILITY_MATRIX.md) #19）；残余风险项关闭 |
| **`tool-inventory.js`** — 单一运行时无关工具清单；策略派生、桥接导入 | 文档化为新的结构性漂移栅栏 |
| **`zimbra_forward_email`** 新只读转发草稿工具（注册 28 工具；策略 30/42/12） | 工具目录行 + 转发流程；UI 草稿卡；产品概述 |
| **`python-command.js`** 共享一次性 Python 运行器（剔除管理凭据；超时/中止/解析） | 宿主/归属/接口目录更新；新 `python-command.test.js` |
| **SQL Schema 迁移**（`migrations/*.sql`、`schema.py`、advisory lock、`soc_schema_migrations`、URI 走 stdin）；Node DDL 移除 | 数据存储目录、接口目录、配置参考 |
| **`test-splunk` 移至桥接**：实时 `splunk_get_info` 探测 + 令牌脱敏；`admin_cli` 删除该命令；端点 URL 校验 | 组件目录 §8/§11、接口目录、故障排除、运维 |
| **`SplunkSettings` 精简**为五个桥接字段；全部遗留 Splunk REST/策略/查找/队列变量删除；`.env.example` 瘦身；遗留 Zimbra 账户变量移除 | 配置参考重写 |
| **setup 要求官方 MCP 连接**（REST Splunk 字段移除；单一参数清单） | 快速开始、运维 |
| **客户端**：遗留状态卡删除；`lib/` 重建（−441 行）；AdminConsole `StatusNotice` 模式；转发草稿卡支持 | UI 页、组件目录、源码索引 |
| **`hi.txt` 删除** | 上一轮审计问题关闭 |
| **vendor `apiproxy`**：结构化认证错误码钉入上游（含测试） | 接口目录补丁接缝节 |

## 3. 实际运行过的检查命令

| 命令 / 方法 | 目的 | 结果 |
|---|---|---|
| `git log`、`git diff --stat b26d55d..HEAD`、逐路径 diff、`git show HEAD:<file>` | 第二轮变更研究 | 完成；汇总于 §2 |
| `git ls-files`（重计：apps 71 = 17 宿主 + 54 服务器；packages 38；skills 4；patches 1；root 8；docs 60 → 含 docs 共 182 个第一方文件） | 普查刷新 | 完成 — [reference/REPOSITORY_MAP.md](../reference/REPOSITORY_MAP.md) |
| 变更后的第一方源码通读（`policy.js`、`tool-inventory.js`、`python-command.js`、`host.js`、`ownership.js`、`splunk-bridge.js`、`server.py`、`config.py`、`schema.py`、`migrations/*.sql`、`postgres_store.py`、`admin_cli.py`、`auth_cli.py`、`zimbra/mail/{service,tools}.py`、`zimbra.py`、客户端 diff、`setup.sh`、README、`.env.example`） | 主要证据 | 完成 |
| 常量抽查（会话 TTL、池大小、正文钳制 ≤100 000、12 个头部允许列表 + "between 1 and 12" 消息、归档/LRU 限额、背景常量、`MAX_REDIRECTS=5`、预设值） | 关键数字 | 全部与源一致 |
| 测试源码审阅 + **执行**：`npm test`（宿主）、`npm test`（客户端）、`uv run pytest` 尝试 | 实测证据 | 宿主：**计数 29 中 25 通过**，4 个文件级失败 — 单一环境根因（§7a）。客户端：**12/12 通过**。Python：**受阻**于不完整虚拟环境（§7a） |
| Python 校验器（`/tmp/validate-docs.py`，一次性）: MD/HTML 链接 + 片段锚点、HTML 标签平衡（含内联 SVG）、远程引用禁令、script 接线、核对头存在、必需文件、违禁内容扫描、双语链接存在、MD↔HTML 对等 | 自动化检查 | **最终运行: 0 错误, 0 警告** |
| `git status` / `git diff --stat` | 变更范围 | 仅 `docs/**` 跟踪变更（§12） |

## 4. 刻意排除的路径（及原因）

| 路径 | 原因 |
|---|---|
| `vendor/deepseek-harness/**` 内部 | 未修改的上游；只读集成面及本轮唯一变更文件（`apiproxy` RPC schema） |
| `**/node_modules/`、`.venv/`、`__pycache__/`、构建 `dist/` | 依赖/缓存/构建工件 |
| `.env` 文件、`~/.dsh/` 内容、`.data/`、`.state/` | 机密/运行时数据 — 从不读取；仅结构化记录 |
| 未跟踪残留 `unified_mcp_server/splunk/`、`catalog/`、`__pycache__/` | 已从 Git 删除；磁盘上的陈旧目录 — 已分类、未检查 |
| `benchmarks/`、`packages/soc-agent-scheduler/node_modules/` | 无跟踪内容；无角色 |

## 5. 第一方覆盖摘要

- **182/182 个被跟踪第一方文件已分类** — root 8、`apps/soc-agent` 71（17 宿主 + 54 服务器）、`packages/soc-agent-client` 38、`skills` 4、`patches` 1、`docs` 60（本套文档 + 简报 + 维护者实施报告）— 外加按组覆盖的 vendored 树。
- 组件矩阵 16 个组件（11 字段）；28 工具 + 13 桥接读 + 非 MCP 名已编目；15 条运行时流程含失败分支；10 个图源 + 10 个交互 SVG（英文站）与中文站内联图。

## 6. 发现的矛盾及解决（累计）

| 矛盾 | 解决 |
|---|---|
| 简报/范围预期存在 `integrations/` | 已从 Git 历史移除；被桥接方案取代。已记录；简报已更正 |
| `AGENTS.md` 列 7 技能；`skills/` 只有 4 | 仍开放 — **维护者问题 1** |
| 检测/SPL 技能引用仅保留（未注册）的工具 | **本轮恶化：** 实现已删除，`detection-engineering`、`spl-writing`、`false-positive-analysis` 部分引用的工具在仓库中已不存在。**维护者问题 2** |
| `zimbra_send_email` 名字暗示发送 | 以证据解决（docstring、工具代码、策略分类、UI 标签）；文档化为典型"名字 vs 行为"陷阱 |
| `zimbra_forward_email` 同类模式 | 主动记录：只读分类的草稿准备；投递仅经确认后的发送路径 |
| `.env.example` 混合活跃与遗留变量 | **本轮在上游解决：** 遗留族已删除；参考只列活跃变量 |
| Send 确认"界面级 vs 服务端强制" | 以证据解决：`window.confirm` 是界面控制；服务端强制会话认证 + `ZIMBRA_ALLOW_SEND` + Zimbra `sent:true`；无确认令牌（可追溯 #34） |
| 保留的 Splunk 代码"存在但未注册" | **本轮解决：** 全部删除；`test_server_tools.py` 仍是防复活的门 |
| `hi.txt` 未分类 | **解决：** 上游删除 |
| `packages/soc-agent-scheduler` 无清单的本地目录 | **仍开放 — 维护者问题** |
| 根 README 布局描述与现实 | 上游已更新（链接实施报告与 MCP 必配），与本套一致 |

## 7. 无法运行的检查（及替代）

### 7a. 测试套件执行结果（实测，本轮）

- **客户端 TS 套件: 12/12 通过**（tsx 加载器，离线）— 含新增 `admin-console` 与转发草稿测试。
- **宿主 JS 套件: 计数 29 中 25 通过。** 四个文件级失败（`background`、`policy`、`splunk-bridge`、`user-mode`）是**导入错误而非断言失败**: `ERR_MODULE_NOT_FOUND: '@deepseek-ai/schemastery'` — 本 checkout 的 `apps/soc-agent/node_modules` 缺少 `./setup.sh`（harness `pnpm install`）会创建的 pnpm 工作区链接。修复需要依赖安装，按治理规则须单独授权；如实记录而不强行执行。能运行的栅栏测试不受影响：`skills.test.js`（补丁/允许列表钉扎）与 `splunk-bridge.test.js` 通过。
- **Python 套件: 执行前受阻。** 收集在不完整虚拟环境上失败（缺 `mcp`、`zimbra_client`）；`uv sync --extra test` 可修复 — 依赖安装同样需要单独授权。本轮未执行任何 Python 断言；覆盖矩阵描述的是源码验证过的契约。

### 7b. 用替代手段的检查

| 检查 | 无法运行的原因 | 替代 |
|---|---|---|
| `docs/diagrams/*.mmd` 的 Mermaid 渲染 | 无渲染器；禁止加依赖 | 由同一数据再生成可访问 SVG（`<title>`/`<desc>` + 逐节点链接）；`.mmd` 语法未经渲染器校验（记录的限制） |
| 真实浏览器过一遍（视口、键盘、读屏器） | 无浏览器 | 语义 HTML、landmark、skip link、focus-visible、reduced-motion、打印规则；内联 SVG 暴露可聚焦链接；静态标签平衡 + 锚点校验 |
| HTML/CSS 校验器二进制 | 未安装 | Python `html.parser` 平衡检查；CSS 按简报站点规则评审 |
| 第二人冷读 | 单作者会话 | 九问冷读表（§7c）；中文版另经中英对照逐页生成 |

### 7c. 使命冷读结果（九问，仅用文档）

| # | 问题 | 由谁回答 | 状态 |
|---|---|---|---|
| 1 | 问题与用户 | [README.md](README.md) · [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | 已回答 |
| 2 | 组件、位置、归属 | [reference/COMPONENT_CATALOG.md](../reference/COMPONENT_CATALOG.md) · [reference/REPOSITORY_MAP.md](../reference/REPOSITORY_MAP.md) | 已回答 |
| 3 | 浏览器/宿主/MCP/Python/外部/持久化/技能/vendor 如何互动 | [ARCHITECTURE.md](ARCHITECTURE.md) · [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) | 已回答 |
| 4 | 身份、归属、隔离、授权、审批、邮件确认、信任边界 | [AUTHENTICATION_AND_OWNERSHIP.md](AUTHENTICATION_AND_OWNERSHIP.md) · [SECURITY_AND_TRUST_BOUNDARIES.md](SECURITY_AND_TRUST_BOUNDARIES.md) | 已回答 |
| 5 | 启动 → 请求 → Splunk → Zimbra → 订阅 → 管理变更 | [RUNTIME_FLOWS.md](RUNTIME_FLOWS.md) 流程 1–15 | 已回答 |
| 6 | 接口、工具、配置、存储、命令、测试 | [reference/INTERFACE_CATALOG.md](../reference/INTERFACE_CATALOG.md) · [reference/MCP_TOOL_CATALOG.md](../reference/MCP_TOOL_CATALOG.md) · [reference/CONFIGURATION_REFERENCE.md](../reference/CONFIGURATION_REFERENCE.md) · [reference/DATA_STORE_CATALOG.md](../reference/DATA_STORE_CATALOG.md) · [reference/TEST_COVERAGE_MATRIX.md](../reference/TEST_COVERAGE_MATRIX.md) | 已回答 |
| 7 | 开发者安装/运行/测试/排障/变更 | [GETTING_STARTED.md](GETTING_STARTED.md) · [DEVELOPMENT.md](DEVELOPMENT.md) · [TESTING.md](TESTING.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 已回答 |
| 8 | 活跃/移除/生成/vendored/遗留分类 | [reference/REPOSITORY_MAP.md](../reference/REPOSITORY_MAP.md) §9 · 组件目录图例 | 已回答 |
| 9 | 已确认 vs 推断 vs 未知 | [reference/TRACEABILITY_MATRIX.md](../reference/TRACEABILITY_MATRIX.md) · 本审计 §8 | 已回答 |

## 8. 已知未知与维护者问题

1. **技能漂移** — 补齐三个缺失的 `SKILL.md`（`soc-incident-triage`、`email-to-splunk-investigation`、`zimbra-operations`）还是精简 `AGENTS.md` 名单？
2. **检测/SPL 技能** — 现引用已移除的工具：把技能更新为桥接-only 面，还是恢复编译器工具？（维护者的 shortening 报告选择了移除。）
3. **`packages/soc-agent-scheduler`** — 放弃（删除本地目录）还是恢复清单？
4. **服务端发送确认** — 政策上是否需要确认令牌，还是界面确认 + 门 + `sent:true` 已可接受？
5. **保留策略** — 工作区/对话保留的部署级策略？
6. **部署拓扑** — 曾由 `RUNNING_INSIDE_DOCKER` 暗示（该变量处理已随本轮移除）的容器部署 — 外部补文档或忽略。
7. **磁盘残留目录**（`unified_mcp_server/splunk/`、`catalog/`、证据存储 SQLite 文件）— 可安全删除；请确认。
8. **中文文档维护** — 本轮新增 `docs/zh/` 与 `docs/site/zh/`；后续代码变更需双语文档同步（建议把 zh 链接检查纳入既有校验器）。

## 9. 已修正的失效/陈旧文档

- 第二轮更正了重构影响的每一页（计数 27→28 工具、29/41/12→30/42/12、保留→移除、`test-splunk` 语义、迁移、转发、setup 必配）— 可追溯矩阵是这些更正的索引。
- 根 `README.md`、`BACKGROUND.md`、`AGENTS.md`、服务器 README 由**维护者在上游更新**，与本套一致；简报的范围在第一轮前已更正。
- 中文版与英文版同轮生成，逐页对应；发现的少量英文遗留计数（站点页 27/29/41/75）已在双语最终校验中一并修正。

## 10. Markdown ↔ HTML 对等结果（含双语）

- 映射: index ← README+PRODUCT_OVERVIEW · getting-started ← GETTING_STARTED · architecture ← ARCHITECTURE · flows ← RUNTIME_FLOWS+USER_INTERFACE · mcp-tooling ← MCP_AND_TOOL_ROUTING · security ← AUTHENTICATION+SECURITY · development ← DEVELOPMENT+TESTING · operations ← DEPLOYMENT+CONFIGURATION+DATA · reference ← reference/* · troubleshooting ← TROUBLESHOOTING；`SHORTENING_PLAN_IMPLEMENTATION.md` 与本审计从站点链接而不重复成页。
- 每个主 Markdown 页都可从站点到达（校验器检查）；每个站点页声明其来源 Markdown；交互层（内联可点击 SVG、页面搜索、scrollspy）是渐进增强 — 无 JavaScript 时全部内容与导航照常工作。
- **双语对等:** `docs/zh/` 逐页对应英文主文档与参考目录；`docs/site/zh/` 逐页对应英文站点；双向语言切换器位于每页（MD 页首行、站点页头导航）。

## 11. 校验结果（最终运行）

- Markdown/HTML 链接 + 片段锚点: **全部有效**（含 zh 树的交叉链接）。
- HTML: 20 页（10 英 + 10 中）标签平衡解析通过；每页含核对提交；无远程引用；本地引用全部解析。
- 违禁内容扫描: 无机密模式、无开发者主目录绝对路径、无客户标识符、无占位文本。
- 必需文件: 英文 16 主页 + 10 目录 + 10 `.mmd` + 10 SVG + 11 站点文件；中文 29 MD + 10 HTML + 10 中文 SVG — 全部存在，无占位页。
- 范围: 仅 `docs/**` 变更（§12）。

## 12. 变更范围确认

- 本轮修改的跟踪文件全部位于 `docs/`（内容更新到 `56c8dd2`、双语化、交互站点层: `site/script.js`、内联 SVG、样式、`site/zh/`）。
- 文档工作未触碰应用代码、测试、清单、锁文件、补丁或 vendor 文件。未调用任何活服务。未读取或复现任何机密值。Splunk 栈的移除由维护者在上游完成（记录于 `SHORTENING_PLAN_IMPLEMENTATION.md`），并非文档工作所为。
