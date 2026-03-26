export type DeriveChangeType = 'create' | 'update' | 'delete' | 'unknown'

export type DeriveChange = {
  type: DeriveChangeType
  path: string
  timestamp?: number
  content?: unknown
}

export type DeriveEvent =
  | {
      type: 'full'
      changes: DeriveChange[]
    }
  | {
      type: 'patch'
      changes: DeriveChange[]
    }

export type EmitFile =
  | { path: string; content: string }
  | { path: string; type: 'delete' }

export type EmitResult = {
  files: EmitFile[]
}

export type BuiltinLoadType = 'text' | 'json' | 'buffer' | 'import'

export type LoadResult =
  | undefined
  | BuiltinLoadType
  | {
      content: unknown
    }

export type LoadResolver = (path: string) => LoadResult | Promise<LoadResult>

export type DerivePluginOptions = {
  /**
   * 工程根目录，默认 `process.cwd()`
   */
  root?: string
  /**
   * 监听文件 glob（相对 `root`）
   */
  watch: string | string[]
  /**
   * 为 true 时打印运行日志
   */
  verbose?: boolean
  /**
   * 根据文件路径决定是否加载内容，并如何加载。
   */
  load?: LoadResolver
  /**
   * 接收 full/patch 事件，返回要写入/删除的文件列表。
   */
  derive: (event: DeriveEvent) => EmitResult | Promise<EmitResult>
}

