## unplugin-derive

基于 [unplugin](https://github.com/unjs/unplugin) 的通用派生引擎：

- 监听 `watch` 文件变化
- 触发 `derive(event)`（`full`/`patch`）
- 根据返回的 `files` 写入或删除目标文件

### 安装

```bash
pnpm add -D unplugin-derive
```

### 用法（Vite）

```ts
import { defineConfig } from 'vite'
import Derive from 'unplugin-derive/vite'

export default defineConfig({
  plugins: [
    Derive({
      watch: ['src/api/**/*.js'],
      load(path) {
        if (path.endsWith('.js')) return 'text'
        return undefined
      },
      async derive(event) {
        const count = event.changes.length
        const content = `// generated from ${event.type}, files: ${count}\n`
        return {
          files: [{ path: 'src/generated.txt', content }]
        }
      },
      verbose: true
    })
  ]
})
```

### 选项

- **root**: 工程根目录（默认 `process.cwd()`）
- **watch**: 监听文件 glob（相对 `root`）
- **load**: 可选内容加载器。返回 `undefined`（不加载）/`"text"`/`"json"`/`"buffer"`/`{ content }`
- **derive**: 核心回调，签名 `derive(event: DeriveEvent)`，返回 `{ files }`
- **verbose**: 输出运行日志（默认 `false`）

### 事件和返回值

- `DeriveEvent`
  - `type: "full" | "patch"`
  - `changes: Array<{ type, path, timestamp?, content? }>`
- `EmitResult`
  - `files: Array<{ path, content } | { path, type: "delete" }>`

### 队列语义

- 同一时刻只会执行一个 `derive`
- 运行中收到 `patch` 会合并排队
- 运行中收到 `full` 会清空未开始的 `patch`，并在当前任务结束后优先执行 `full`

### 示例

- 项目特定的 API 解析和 `types.d.ts` 渲染逻辑已放在 `examples/webpack-dts`
