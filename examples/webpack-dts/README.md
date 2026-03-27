## webpack-dts example

### Run

```bash
pnpm install
pnpm --filter webpack-dts-example run build
```

构建时会通过 `unplugin-derive/webpack` 扫描 `src/api/**/*.js`，并生成 `src/api/types.d.ts`。
示例中的 `load` 使用了内置 `"import"`，直接读取模块导出（`default`/`category`），避免手写文件读取。

这里的解析和渲染逻辑不在插件核心中，而是在示例内实现：

- `derive/index.cjs` 负责解析 `event.changes[*].content`
- 输出 `EmitResult.files`，由 `unplugin-derive` 统一落盘

