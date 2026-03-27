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

export type BannerStyle = 'line-slash' | 'line-hash' | 'block-star' | 'block-jsdoc'

export type BannerOverviewNode =
  | string
  | {
      description?: string
      items?: BannerOverviewNode[]
    }

export type BannerData = Record<string, unknown> & {
  author?: string | string[]
  source?: string | string[]
  overview?: BannerOverviewNode
}

export type BannerRenderContext = {
  path: string
  content: string
  data: BannerData
  style: BannerStyle
}

export type BannerConfig = {
  style?: BannerStyle
  template?: string
  formatter?: (context: BannerRenderContext) => string
  data?: BannerData
}

export type EmitFile =
  | { path: string; content: string; banner?: false | BannerConfig }
  | { path: string; type: 'delete'; banner?: false | BannerConfig }

export type EmitResult = {
  files: EmitFile[]
  banner?: false | BannerConfig
}

export type BuiltinLoadType = 'text' | 'json' | 'buffer' | 'import'

export type LoadResult =
  | undefined
  | BuiltinLoadType
  | {
      content: unknown
    }

export type LoadResolver = (path: string) => LoadResult | Promise<LoadResult>

export type GitignoreMatcher = (file: string) => boolean
export type GitignoreOption = true | string | string[] | GitignoreMatcher
export type DeriveBuildStartType = 'full' | 'none'
export type DeriveWatchChangeType = DeriveEvent['type'] | 'none'
export type DeriveWhen = {
  buildStart?: DeriveBuildStartType
  watchChange?: DeriveWatchChangeType
}

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
  /**
   * 全局 banner 配置，支持被 EmitResult / EmitFile 覆盖。
   */
  banner?: false | BannerConfig
  /**
   * 自动将输出文件加入 `root/.gitignore`。
   */
  gitignore?: GitignoreOption
  /**
   * 控制各阶段触发 `derive` 的事件类型。
   */
  deriveWhen?: DeriveWhen
}

