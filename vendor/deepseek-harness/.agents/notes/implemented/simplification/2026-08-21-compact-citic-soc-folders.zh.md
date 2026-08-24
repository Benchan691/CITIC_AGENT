# Agent Note：紧凑的 CITIC SOC Folder 与运行时组合

状态：已实现

[English](2026-08-21-compact-citic-soc-folders.md) | 中文

## 问题

产品组合仍把文件系统目录选择器视为必需能力，但 CITIC SOC 工作流已经通过逻辑 Folder 对调查进行分组。移除选择器后，API gateway 会停留在 pending，使所有 `/api/*` 请求变成 404，并让浏览器无限重连。Folder 模式刷新还会丢失独立的归档基线；回放中新播种的 Session 错过启动时的 Folder 迁移；初始选择可能递归重开持久 Session；标准回放 preset 也曾被改成禁用工具的 SOC persona，令无关的交互回放超时。

## 决策

产品默认使用专用的 `citic-soc` preset，其中只保留 SOC persona、指令、调查 skill、compaction、command、pruning 与 ask-user 能力。标准 coding preset 继续作为稳定的回放 fixture。Web 组合移除目录选择器 UI 及其未使用依赖。

API gateway 不再把目录选择器注入为启动条件。旧目录 endpoint 在请求时发现该能力；缺失时返回 `directory-picker-unavailable`，其他 API 仍正常激活。Folder 刷新把 `folder.list` 适配到现有客户端投影，并发调用 `workspace.list` 只为取得注册表级全局归档快照。为当前空 Session 选择逻辑 Folder 时会原地移动该 Session；可变 Folder 归属优先于创建时的 header，导航代数则阻止较早的 New Session 请求覆盖较新的 Folder 选择。初始选择会在打开持久 Session 前完成启动状态。回放 setup 在写入持久数据后把新播种 Session 分配到 General，使测试符合启动后导入的真实顺序；同时断言组合条目已激活，而不只是已加载。

## 验证

CLI preset 目录、Cordis 配置校验、聚焦的客户端 runtime 与 API gateway 测试、wallpaper 与 Folder UI 测试、库构建和 TypeScript 构建均通过。长交互、滚动契约、导航面板和重写后的逻辑 Folder workspace 回放均通过，覆盖可选 Folder 的 composer 回归、Folder 重名反馈、重命名／删除、flat view 持久化、归档恢复，以及不调用模型的 clean run。

## 考虑过的替代方案

**保留目录选择器但隐藏控件。** 拒绝，因为产品并不使用该能力，这仍会保留文件系统权限与依赖，并继续让 gateway 启动耦合到可选兼容功能。

**用 SOC preset 替换标准 preset。** 拒绝，因为回放测试有意覆盖通用 coding 工具和 renderer 契约。产品默认值与测试 fixture 目的不同，应分别命名。

**从 Folder 响应推导归档。** 拒绝，因为 Folder 成员关系与全局归档集合具有不同的所有者和生命周期。并行基线无需扩展 Folder schema 即可保留两者。

## 后果

CITIC SOC 界面以更小的能力集启动且不含目录浏览器，旧 Host 仍可提供可选的目录选择 endpoint。逻辑 Folder 与现有 Workspace 形状的 renderer 契约保持兼容；Folder 模式重载后归档仍然有效；播种的调查立即可见；回放会直接指出未激活的组合条目，而不会退化为 WebSocket 超时。
