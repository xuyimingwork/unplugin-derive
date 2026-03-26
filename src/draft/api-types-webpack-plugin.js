const path = require('path')
const { PLUGIN_NAME } = require('./constants')
const { collectApiDefinitions } = require('./collect-definitions')
const { renderDts } = require('./render-dts')
const { writeIfChanged } = require('./write-if-changed')
const {
  resolvePluginOptions,
  patternToWatchDir
} = require('./resolve-plugin-options')
const { ensureOutputInGitignore } = require('./ensure-output-in-gitignore')

/**
 * @typedef {object} ApiTypesPluginUserOptions
 * @property {string} [root] 工程根目录，默认 `compiler.context` 或 `process.cwd()`
 * @property {string | string[]} [include] 要扫描文件的 glob（相对 `root`），默认与 `DEFAULT_INCLUDE` 相同
 * @property {string} [output] 生成的声明文件路径；省略为 `src/api/types.d.ts`（相对 `root`）
 * @property {boolean} [verbose] 为 true 时输出被跳过的文件
 */

/**
 * 为 `this.$api` 从 API 配置目录（AST）生成 `types.d.ts`。
 * @param {ApiTypesPluginUserOptions} [options]
 */
class ApiTypesWebpackPlugin {
  constructor(options = {}) {
    this.options = options
  }

  /** @returns {string} Webpack 5 用于统计与日志的插件标识 */
  static get name() {
    return PLUGIN_NAME
  }

  apply(compiler) {
    const { root, include, output, verbose } = resolvePluginOptions(
      this.options,
      compiler
    )

    const watchDirs = [...new Set(include.map(p => patternToWatchDir(root, p)))]

    const infraLogger = compiler.getInfrastructureLogger
      ? compiler.getInfrastructureLogger(PLUGIN_NAME)
      : null

    const run = () => {
      const skipped = []
      const generationStart = Date.now()
      const { entries, stats } = collectApiDefinitions(
        include,
        root,
        (rel, err) => {
          skipped.push({ rel, message: err.message })
        }
      )
      const statsForRender = {
        ...stats,
        includeGlobs: include,
        outputRelative: path.relative(root, output).replace(/\\/g, '/'),
        _generationStart: generationStart
      }
      const dts = renderDts(entries, statsForRender)
      writeIfChanged(output, dts)
      try {
        ensureOutputInGitignore(root, output)
      } catch (e) {
        if (verbose) {
          const log = infraLogger
            ? infraLogger.warn.bind(infraLogger)
            : (...args) => console.warn(`[${PLUGIN_NAME}]`, ...args)
          log(`写入 .gitignore 失败：${e.message}`)
        }
      }

      if (verbose && skipped.length) {
        const warn = infraLogger
          ? infraLogger.warn.bind(infraLogger)
          : (...args) => console.warn(`[${PLUGIN_NAME}]`, ...args)
        for (const { rel, message } of skipped) {
          warn(`跳过 ${rel}：${message.split('\n')[0]}`)
        }
      }
    }

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, compilation => {
      for (const dir of watchDirs) {
        compilation.contextDependencies.add(dir)
      }
    })

    compiler.hooks.beforeCompile.tap(PLUGIN_NAME, () => {
      run()
    })
  }
}

module.exports = {
  ApiTypesWebpackPlugin
}
