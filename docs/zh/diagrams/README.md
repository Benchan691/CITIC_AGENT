# 图（中文版）

> **核对基准:** 提交 `56c8dd21492a5c36cb9f3eaa3da01160aba40033`（2026-09-12T07:22:44Z）· 文档核对日期 2026-09-12。
> 语言 / Language: **中文** · [English](../README.md)

文档集中每张图的可编辑 Mermaid 源文件位于 `docs/diagrams/`（英文说明见 [../diagrams/README.md](../../diagrams/README.md)）。每张图同时存在可访问的离线 SVG：英文版在 [`../site/assets/diagrams/`](../../site/assets/)（含 `<title>`/`<desc>` 与节点链接），**中文标签版**在 [`../site/assets/diagrams/zh/`](../../site/assets/) 并内联于中文站各页。SVG 为程序生成的简单渲染；`.mmd` 源是权威的可编辑形态。

| 源文件 | 形态 | 展示 | 中文站嵌入页 |
|---|---|---|---|
| [system-context.mmd](../../diagrams/system-context.mmd) | 上下文图 | 人员、系统边界、外部服务/存储 | [../site/zh/index.html](../../site/zh/index.html) |
| [runtime-containers.mmd](../../diagrams/runtime-containers.mmd) | 架构图 | 浏览器、Node 宿主、Python 子进程、桥接、存储 | [../site/zh/architecture.html](../../site/zh/architecture.html) |
| [component-map.mmd](../../diagrams/component-map.mmd) | 组件/依赖图 | 第一方模块、技能、补丁接缝、vendor、归属 | [../site/zh/architecture.html](../../site/zh/architecture.html) |
| [mcp-routing.mmd](../../diagrams/mcp-routing.mmd) | 路由图 | 原始名、两个服务器、允许列表、策略门、`ui__` 条目、模型/UI 路径 | [../site/zh/mcp-tooling.html](../../site/zh/mcp-tooling.html) |
| [authentication-sequence.mmd](../../diagrams/authentication-sequence.mmd) | 时序图 | 登录、身份、元数据、拒绝路径、登出 | [../site/zh/security.html](../../site/zh/security.html) |
| [action-authorization.mmd](../../diagrams/action-authorization.mmd) | 决策树 | 允许列表 → 模式 → 每工具状态 → 审批 → Python 门 → 邮件专属确认 | [../site/zh/security.html](../../site/zh/security.html) |
| [email-draft-send.mmd](../../diagrams/email-draft-send.mmd) | 状态机 | 草稿生命周期（显式 Send 门、失败/重试） | [../site/zh/flows.html](../../site/zh/flows.html) |
| [data-trust-boundaries.mmd](../../diagrams/data-trust-boundaries.mmd) | 数据流图 | 敏感数据类、存储、脱敏/脱敏点 | [../site/zh/security.html](../../site/zh/security.html) |
| [configuration-precedence.mmd](../../diagrams/configuration-precedence.mmd) | 决策/流程图 | 配置源、默认、加密持久化、消费者 | [../site/zh/operations.html](../../site/zh/operations.html) |
| [build-test-deploy.mmd](../../diagrams/build-test-deploy.mmd) | 生命周期图 | 源码 → 构建 → 测试 → setup 装配 → 部署 → 更新路径 | [../site/zh/operations.html](../../site/zh/operations.html) |

图例（所有图一致）：圆角/椭圆 = 人员；矩形 = 进程/组件；圆柱 = 数据存储；虚线箭头 = 仅人工/可选路径；红色着色节点 = 敏感数据。名称与 [GLOSSARY.md](../reference/GLOSSARY.md) 完全一致。
