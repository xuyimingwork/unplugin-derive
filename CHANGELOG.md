# 更新日志

## [0.2.0] - 2026-03-27

### 新增

- 新增 `deriveWhen` 配置，支持按阶段控制触发事件类型：
  - `buildStart`: `full` | `none`
  - `watchChange`: `patch` | `full` | `none`
- 为 `watchChange: "full"` 增加 watch 范围过滤，仅当变更路径命中 `watch` 时触发 full。

### 优化

- 将 `resolveOptions` 前移到插件入口层，在 `index` 中完成配置解析后再创建 runtime。
- 在 `resolveOptions` 中新增 `prepareGitignore`，并在 emit 前统一执行，不再向 runtime 暴露 `gitignore`/`gitignoreEntries` 细节。
- 抽取并复用 `isPathWatched`，统一输入过滤与输出保护的匹配逻辑。

## [0.1.0] - 2026-03-27

### 新增

- 发布 `unplugin-derive` 的首个可用版本能力集。
- 提供核心派生产物流程与任务调度能力。
- 支持通过 `unplugin` 集成主流构建工具生态。
- 增加 Banner 输出与 Git 相关工作流支持。
- 补充基础测试用例，覆盖核心行为。

### 优化

- 重构并统一配置项处理逻辑。
- 完成代码清理与 MVP 迁移调整。
- 简化示例中的导入方式。

### 修复

- 改进任务调度行为。
- 修复缺失 `require` 处理的问题。

## [0.0.1] - 2026-03-27

### 新增

- 初始版本发布。
