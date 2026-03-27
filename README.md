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

### 其它构建工具（折叠）

<details>
<summary>Rollup / Webpack / esbuild 最小用法</summary>

#### Rollup

```ts
import Derive from 'unplugin-derive/rollup'

export default {
  plugins: [
    Derive({
      watch: ['src/api/**/*.js'],
      async derive() {
        return {
          files: [{ path: 'src/generated.txt', content: 'from rollup\n' }]
        }
      }
    })
  ]
}
```

#### Webpack

```js
const Derive = require('unplugin-derive/webpack').default

module.exports = {
  plugins: [
    Derive({
      watch: ['src/api/**/*.js'],
      async derive() {
        return {
          files: [{ path: 'src/generated.txt', content: 'from webpack\n' }]
        }
      }
    })
  ]
}
```

#### esbuild

```ts
import { build } from 'esbuild'
import Derive from 'unplugin-derive/esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  plugins: [
    Derive({
      watch: ['src/api/**/*.js'],
      async derive() {
        return {
          files: [{ path: 'src/generated.txt', content: 'from esbuild\n' }]
        }
      }
    })
  ]
})
```

</details>

### 选项

- **root**: 工程根目录（默认 `process.cwd()`）
- **watch**: 监听文件 glob（相对 `root`）
- **load**: 可选内容加载器。返回 `undefined`（不加载）/`"text"`/`"json"`/`"buffer"`/`"import"`/`{ content }`
- **derive**: 核心回调，签名 `derive(event: DeriveEvent)`，返回 `{ files }`
- **verbose**: 输出运行日志（默认 `false`）
- **banner**: 全局 banner 配置（可被 `EmitResult.banner` 和 `EmitFile.banner` 覆盖）
- **gitignore**: 自动维护 `root/.gitignore`
  - `true`: 将本次生成文件全部写入 `.gitignore`
  - `string` / `string[]`: 直接作为 `.gitignore` 条目写入
  - `(file) => boolean`: 按文件相对路径过滤后写入
- **deriveWhen**: 控制各阶段触发 `derive` 的事件类型
  - `buildStart`: `full` | `none`（默认 `full`）
  - `watchChange`: `patch` | `full` | `none`（默认 `patch`）
  - 当 `watchChange: "full"` 时，仅在变更路径命中 `watch` 时触发 full

示例：

```ts
Derive({
  watch: ['src/api/**/*.js'],
  deriveWhen: {
    buildStart: 'full',
    watchChange: 'full'
  },
  async derive(event) {
    return {
      files: [{ path: 'src/generated.txt', content: `event=${event.type}\n` }]
    }
  }
})
```

### 事件和返回值

- `DeriveEvent`
  - `type: "full" | "patch"`
  - `changes: Array<{ type, path, timestamp?, content? }>`
- `EmitResult`
  - `files: Array<{ path, content, banner? } | { path, type: "delete", banner? }>`
  - `banner?: false | BannerConfig`

### Banner（可选）

- 覆盖顺序：`DerivePluginOptions.banner` -> `EmitResult.banner` -> `EmitFile.banner`（后者覆盖前者）
- `false` 也遵循同样规则，表示该层显式禁用
- 渲染优先级：`formatter` > `template` > 默认模板（当 `data.author` 存在）
- `style` 可选值：`line-slash` / `line-hash` / `block-star` / `block-jsdoc`

示例（默认模板）：

```ts
Derive({
  watch: ['src/**/*.ts'],
  banner: {
    data: {
      author: 'team-a',
      source: 'src/**/*.ts',
      overview: {
        description: 'generated stats',
        items: ['files: 12', 'methods: 38']
      }
    }
  },
  async derive() {
    return {
      files: [{ path: 'src/generated.ts', content: 'export const x = 1\n' }]
    }
  }
})
```

### 队列语义

- 同一时刻只会执行一个 `derive`
- 运行中收到 `patch` 会合并排队
- 运行中收到 `full` 会清空未开始的 `patch`，并在当前任务结束后优先执行 `full`

### 示例

- 项目特定的 API 解析和 `types.d.ts` 渲染逻辑已放在 `examples/webpack-dts`

### 测试

使用 [Vitest](https://vitest.dev/)：

```bash
pnpm test        # watch 模式
pnpm test:run    # 单次运行
```

当前测试分为两层：

- `test/*.test.ts`：核心单元测试（`options` / `queue` / `runtime`）
- `test/fixture-snapshot.test.ts`：fixture 驱动的快照集成测试

### Fixture / Snapshot 测试约定

fixture 放在 `test/fixtures/<case-name>`，测试会自动扫描每个子目录并执行。

`case.json` 中 loader 配置统一使用 `loadByExtension`，按后缀映射到内置 loader。

每个 fixture 通过 `case.json` 描述：

```json
{
  "watch": "src/**/*.txt",
  "loadByExtension": {
    ".txt": "text",
    ".json": "json"
  },
  "mutateBeforeRun": [
    { "action": "write", "path": "src/a.txt", "content": "new content" },
    { "action": "delete", "path": "src/b.txt" }
  ],
  "run": [
    { "type": "full" },
    {
      "type": "patch",
      "changes": [
        { "type": "update", "path": "src/a.txt" },
        { "type": "delete", "path": "src/b.txt" }
      ]
    }
  ],
  "deriveOutputs": [
    { "path": "event.json", "from": "event-json" },
    { "path": "deleted-log.txt", "from": "deleted-paths" }
  ],
  "snapshotDir": "generated"
}
```

字段说明：

- `watch`: 传给插件的监听 glob（字符串或字符串数组）
- `loadByExtension`（可选）: 后缀到内置 loader 的映射，支持 `text` / `json` / `buffer` / `import`
  - 如：`{ ".txt": "text", ".json": "json" }`
- `mutateBeforeRun`（可选）: 运行前对 fixture 文件系统做变更
  - `write`: 写文件（会自动创建目录）
  - `delete`: 删文件
- `run`: 测试执行步骤（按顺序）
  - `full`: 触发一次 full 事件
  - `patch`: 触发一次 patch 事件，`changes` 与运行时输入一致
- `deriveOutputs`: 派生输出规则数组
  - `path`: 输出文件路径（相对于 `snapshotDir`）
  - `from`: 内容来源，当前支持：
    - `event-json`: 输出完整事件 JSON
    - `deleted-paths`: 输出 delete 变更的路径列表（换行分隔）
- `snapshotDir`: 快照读取目录（相对 fixture 根目录）

新增一个 fixture 的最小步骤：

1. 新建 `test/fixtures/<case-name>/` 与输入文件
2. 新建 `test/fixtures/<case-name>/case.json`
3. 运行 `pnpm vitest run -u` 更新快照
