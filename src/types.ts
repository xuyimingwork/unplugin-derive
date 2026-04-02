export type DeriveChangeType = 'create' | 'update' | 'delete' | 'unknown'

export type DeriveChange = {
  type: DeriveChangeType
  path: string
  content?: unknown
  loader?: string
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

export type DeriveOptionDerive = (event: DeriveEvent) => Promisable<DeriveResult>
export type DeriveResolved = (event: DeriveEvent) => Promise<DeriveResultResolved>

export type DeriveBannerStyle = 'line-slash' | 'line-hash' | 'block-star' | 'block-jsdoc'

export type DeriveBannerDataOverview =
  | string
  | {
      description?: string
      items?: DeriveBannerDataOverview[]
    }

export type DeriveBannerData = Record<string, unknown> & {
  author?: string | string[]
  source?: string | string[]
  overview?: DeriveBannerDataOverview
}

export type DeriveBannerContext = {
  path: string
  content: string
  data: DeriveBannerData
  style: DeriveBannerStyle
}

export type DeriveBanner = {
  style?: DeriveBannerStyle
  template?: string
  formatter?: (context: DeriveBannerContext) => string
  data?: DeriveBannerData
} | false

export type DeriveResultFile =
  | { path: string; content: string; banner?: DeriveBanner }
  | { path: string; type: 'delete' }


export type DeriveResult = {
  files: DeriveResultFile[]
  banner?: DeriveBanner
}

export type DeriveFileResolved =
  | { path: string; content: string }
  | { path: string; type: 'delete' }

export type DeriveResultResolved = {
  files: DeriveFileResolved[]
}

export type Promisable<T> = T | Promise<T>
export type DeriveLoaderResult = { content: unknown; loader?: string } | undefined
export type DeriveLoaderBuiltin = '_text' | '_json' | '_buffer' | '_import'
export type LegacyBuiltinLoadType = 'text' | 'json' | 'buffer' | 'import'
export type BuiltinLoadType = LegacyBuiltinLoadType
/**
 * @return 
 * - { content: unknown } 表示 loader 已经正常处理资源
 * - undefined/抛出异常 表示 loader 无法处理资源
 */
export type DeriveLoaderBase = (path: string) => Promisable<DeriveLoaderResult>
export type DeriveLoader = DeriveLoaderBase | DeriveLoaderBuiltin
export type DeriveLoadRouter = (path: string) => Promisable<DeriveLoaderBuiltin | DeriveLoader[]>
export type DeriveOptionLoad = DeriveLoader | DeriveLoader[] | DeriveLoadRouter
export type DeriveOptionLoadResolved = (path: string) => Promise<DeriveLoaderResult>

// Backward-compatible aliases used by internal runtime.
export type LoadContentResult = Exclude<DeriveLoaderResult, undefined>
export type LoadContentFactory = DeriveLoaderBase
export type LoadMethod = DeriveLoader | LegacyBuiltinLoadType
export type LoadResult = DeriveLoaderResult | DeriveLoader | DeriveLoader[] | LegacyBuiltinLoadType | LoadMethod[]

export type GitignoreMatcher = (file: string) => boolean
export type DeriveOptionGitignore = true | string | string[] | GitignoreMatcher
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
  load?: DeriveOptionLoad
  /**
   * 接收 full/patch 事件，返回要写入/删除的文件列表。
   */
  derive: DeriveOptionDerive
  /**
   * 全局 banner 配置，支持被 DeriveResult / DeriveResultFile 内的配置覆盖。
   */
  banner?: DeriveBanner
  /**
   * 自动将输出文件加入 `root/.gitignore`。
   */
  gitignore?: DeriveOptionGitignore
  /**
   * 控制各阶段触发 `derive` 的事件类型。
   */
  deriveWhen?: DeriveWhen
}

