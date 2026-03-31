# 更新日志

## [0.4.0] - 2026-03-31

### 新增

- 增加更完整的 `verbose` 运行日志，覆盖任务开始/结束、阶段失败、watch 过滤与事件归一化等关键路径。
- 增加 emit 结果统计日志（`written` / `deleted` / `skipped`），便于快速判断本次派生实际产出。

### 优化

- 优化 `.gitignore` 自动维护日志，区分“无匹配项”“已存在无需追加”“实际追加成功”等状态。

## [0.3.1] - 2026-03-31

### 新增

- `load` 支持数组形式，按顺序尝试多个 loader，命中后停止。
- 数组项支持自定义 loader 工厂（`() => ({ content })`），可与内置 loader 混合使用。

### 优化

- 补充并完善 `load` 相关配置说明、行为约束与测试覆盖。
- 发布流程调整为使用 latest npm 进行发布。

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
