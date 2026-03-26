const path = require('path')

const DEFAULT_INCLUDE = ['src/api/**/*.js']
const DEFAULT_OUTPUT = 'src/api/types.d.ts'

/** glob 无法从字面路径推断目录时（如以 `*` 开头）的回退基准，相对 `root` */
const FALLBACK_INCLUDE_BASE = 'src/api'

/**
 * @param {string | string[] | null | undefined} include
 * @returns {string[]}
 */
function normalizeInclude(include) {
  if (include == null) return [...DEFAULT_INCLUDE]
  if (Array.isArray(include)) {
    return include.length ? include.map(String) : [...DEFAULT_INCLUDE]
  }
  return [String(include)]
}

/**
 * 从 glob 模式推断要监听的目录（取首个 *、?、[ 之前的路径前缀）。
 * 前缀为空时回退到 `FALLBACK_INCLUDE_BASE`，避免把整个 `root` 当作监听目录。
 * @param {string} root
 * @param {string} pattern
 */
function patternToWatchDir(root, pattern) {
  const normalized = String(pattern).replace(/\\/g, '/')
  const idx = normalized.search(/[*?[\\]/)
  const prefix = idx === -1 ? normalized : normalized.slice(0, idx)
  const trimmed = prefix.replace(/\/+$/, '').replace(/^\/+/, '')
  if (!trimmed) {
    return path.resolve(root, FALLBACK_INCLUDE_BASE)
  }
  return path.resolve(root, trimmed)
}

/**
 * 插件配置：`root`、`include`、`output`、`verbose`。
 * - `include`：glob 列表（相对 `root`），默认与文件顶部 `DEFAULT_INCLUDE` 一致
 * - `output`：生成的 `.d.ts` 路径，相对 `root`；省略时为 `DEFAULT_OUTPUT`
 *
 * @param {object} opts
 * @param {{ context?: string }} compiler
 * @returns {{ root: string, include: string[], output: string, verbose: boolean }}
 */
function resolvePluginOptions(opts, compiler) {
  const root = path.resolve(opts.root ?? compiler.context ?? process.cwd())
  const patterns = normalizeInclude(opts.include)

  const o = opts.output != null ? opts.output : DEFAULT_OUTPUT
  const outputPath = path.isAbsolute(o) ? o : path.resolve(root, o)

  const verbose = opts.verbose === true

  return {
    root,
    include: patterns,
    output: outputPath,
    verbose
  }
}

module.exports = {
  resolvePluginOptions,
  normalizeInclude,
  patternToWatchDir,
  DEFAULT_INCLUDE,
  DEFAULT_OUTPUT,
  FALLBACK_INCLUDE_BASE
}
