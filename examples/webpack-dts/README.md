## webpack-dts example

### Run

```bash
pnpm install
pnpm --filter webpack-dts-example run build
```

构建时会通过 `unplugin-derive/webpack` 扫描 `src/api/**/*.js`，并生成 `src/api/types.d.ts`。
示例中的 `load` 使用了内置 `"import"`，直接读取模块导出（`default`/`category`），避免手写文件读取。

这里的 API 解析逻辑仍在示例内；banner 已支持通过插件通用配置下沉：

- `derive/index.cjs` 负责解析 `event.changes[*].content`
- 仅返回 `banner.data` + `EmitResult.files`，由 `unplugin-derive` 统一渲染注释并落盘
- `.gitignore` 维护由插件 `gitignore` 选项负责，示例中不再手写文件操作逻辑

