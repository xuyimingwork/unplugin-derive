const path = require('node:path')
const DEFAULT_INCLUDE = ['src/api/**/*.js']
const FALLBACK_INCLUDE_BASE = 'src/api'

function escapeJSDoc(text) {
  if (text == null) return ''
  return String(text).replace(/\*\//g, '*\\/').replace(/\r?\n/g, ' ')
}

function buildItemJSDoc(item, category, sourceRelPath) {
  const lines = []
  const title =
    item.name != null ? escapeJSDoc(item.name) : escapeJSDoc(item.method || '接口')
  lines.push(title)
  const remarks = []
  if (category) remarks.push(`- 分类：${escapeJSDoc(category)}`)
  if (item.type != null || item.url != null) {
    const verb = item.type != null ? String(item.type).toUpperCase() : ''
    const url = item.url != null ? escapeJSDoc(item.url) : ''
    remarks.push(
      verb && url ? `- 请求：${verb} ${url}` : url ? `- 请求地址：${url}` : `- 请求方式：${verb}`
    )
  }
  remarks.push(`- 源文件：${escapeJSDoc(sourceRelPath)}`)
  const skip = new Set(['name', 'url', 'type', 'method'])
  for (const [k, v] of Object.entries(item)) {
    if (skip.has(k) || v === undefined) continue
    remarks.push(`- ${escapeJSDoc(k)}：${escapeJSDoc(v)}`)
  }
  if (remarks.length) {
    lines.push('@remarks')
    lines.push(...remarks)
  }
  return lines.join('\n')
}

function literalToDisplay(value) {
  if (value == null) return 'null'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[dynamic]'
    }
  }
  return '[dynamic]'
}

function normalizeApiItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (typeof raw.method !== 'string' || !raw.method) return null
  const out = { method: raw.method }
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'method') continue
    out[k] = literalToDisplay(v)
  }
  return out
}

function parseApiModule(moduleExports) {
  if (!moduleExports || typeof moduleExports !== 'object') return null
  const arr = Array.isArray(moduleExports.default) ? moduleExports.default : null
  if (!arr) return null
  const category =
    typeof moduleExports.category === 'string' ? moduleExports.category : undefined
  const items = []
  for (const el of arr) {
    const item = normalizeApiItem(el)
    if (item) items.push(item)
  }
  return { category, items }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatElapsedMs(ms) {
  const n = Math.max(0, Math.floor(Number(ms) || 0))
  if (n < 1000) return `${n}ms`
  const sec = Math.floor(n / 1000)
  const min = Math.floor(sec / 60)
  const remainSec = sec % 60
  if (min > 0) return `${min}m${pad2(remainSec)}s`
  return `${remainSec}s${n % 1000}ms`
}

function formatGenerationTimeLine(elapsedMs) {
  const d = new Date()
  const at = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  return `${at} (elapsed: ${formatElapsedMs(elapsedMs)})`
}

function patternToWatchDir(root, pattern) {
  const normalized = String(pattern || '').replace(/\\/g, '/')
  const idx = normalized.search(/[*?[\\]/)
  const prefix = idx === -1 ? normalized : normalized.slice(0, idx)
  const trimmed = prefix.replace(/\/+$/, '').replace(/^\/+/, '')
  if (!trimmed) return path.resolve(root, FALLBACK_INCLUDE_BASE)
  return path.resolve(root, trimmed)
}

function toPosixPath(p) {
  return String(p || '').replace(/\\/g, '/')
}

function renderDts(entries) {
  const lines = entries.map(item => {
    const doc = item.jsdoc ? `  /**\n   * ${item.jsdoc.split('\n').join('\n   * ')}\n   */\n` : ''
    return `${doc}  ${item.method}(config?: AxiosRequestConfig): Promise<any>`
  })
  return `import type { AxiosRequestConfig } from 'axios'

export interface ApiInstance {
${lines.join(',\n')}
}

declare module 'vue/types/vue' {
  interface Vue {
    $api: ApiInstance
  }
}

export {}
`
}

function createBannerOverview(stats) {
  const duplicateLines = stats.duplicateMethods.map(v => `${v.method}: ${v.files.join('|')}`)
  return {
    description: 'Auto generation stats',
    items: [
      `include: ${stats.includeGlobs.join('; ')}`,
      `output: ${stats.outputRelative}`,
      `scanned files: ${stats.filesScanned}`,
      `generated methods: ${stats.methodsGenerated}`,
      `skipped files: ${stats.skippedFilePaths.length}${stats.skippedFilePaths.length ? ` (${stats.skippedFilePaths.join(', ')})` : ''}`,
      `empty files: ${stats.emptyFilePaths.length}${stats.emptyFilePaths.length ? ` (${stats.emptyFilePaths.join(', ')})` : ''}`,
      {
        description: `duplicate methods: ${stats.duplicateMethods.length}`,
        items: duplicateLines.length ? duplicateLines : ['none']
      },
      `generated at: ${formatGenerationTimeLine(Date.now() - stats.generationStart)}`
    ]
  }
}

function createWebpackDtsDerive(input) {
  const config =
    typeof input === 'string'
      ? { outputPath: input }
      : {
          outputPath: input.outputPath,
          include: input.include,
          root: input.root,
          verbose: input.verbose === true
        }
  const outputPath = config.outputPath
  const includeGlobsRaw = Array.isArray(config.include)
    ? config.include.map(String)
    : typeof config.include === 'string'
      ? [config.include]
      : []
  const includeGlobs = includeGlobsRaw.length ? includeGlobsRaw : [...DEFAULT_INCLUDE]
  const projectRoot = config.root ? path.resolve(config.root) : process.cwd()
  const verbose = config.verbose === true
  const apiRoot = patternToWatchDir(projectRoot, includeGlobs[0])
  const fileContents = new Map()
  return async function derive(event) {
    if (event.type === 'full') {
      fileContents.clear()
      for (const change of event.changes) {
        if (change.content !== undefined) {
          fileContents.set(toPosixPath(change.path), change.content)
        }
      }
    } else {
      for (const change of event.changes) {
        if (change.type === 'delete') {
          fileContents.delete(toPosixPath(change.path))
          continue
        }
        if (change.content !== undefined) {
          fileContents.set(toPosixPath(change.path), change.content)
        }
      }
    }

    const methodToBlocks = new Map()
    const methodToSourceFiles = new Map()
    const skippedFilePaths = []
    const emptyFilePaths = []
    let filesScanned = 0
    const generationStart = Date.now()

    for (const [relPath, content] of fileContents) {
      const absPath = path.resolve(projectRoot, relPath)
      if (path.relative(apiRoot, absPath).replace(/\\/g, '/') === 'index.js') continue
      filesScanned++
      const parsed = parseApiModule(content)
      if (!parsed) {
        skippedFilePaths.push(relPath)
        if (verbose) {
          console.warn(
            `[webpack-dts-example] skip ${relPath}: parse failed or no default export array`
          )
        }
        continue
      }
      if (!parsed.items.length) {
        emptyFilePaths.push(relPath)
        continue
      }
      for (const item of parsed.items) {
        if (!item.method) continue
        const block = buildItemJSDoc(item, parsed.category, relPath)
        const list = methodToBlocks.get(item.method) || []
        list.push(block)
        methodToBlocks.set(item.method, list)
        if (!methodToSourceFiles.has(item.method)) {
          methodToSourceFiles.set(item.method, new Set())
        }
        methodToSourceFiles.get(item.method).add(relPath)
      }
    }
    const methods = [...methodToBlocks.keys()].sort((a, b) => a.localeCompare(b))
    const entries = methods.map(method => {
      const blocks = methodToBlocks.get(method) || []
      return {
        method,
        jsdoc: blocks.length > 1 ? blocks.join('\n---\n') : blocks[0]
      }
    })
    const duplicateMethods = []
    for (const [method, fileSet] of methodToSourceFiles) {
      if (fileSet.size > 1) {
        duplicateMethods.push({
          method,
          files: [...fileSet].sort()
        })
      }
    }
    duplicateMethods.sort((a, b) => a.method.localeCompare(b.method))
    const stats = {
      filesScanned,
      methodsGenerated: entries.length,
      skippedFilePaths: skippedFilePaths.sort(),
      emptyFilePaths: emptyFilePaths.sort(),
      duplicateMethods,
      generationStart,
      includeGlobs,
      outputRelative: toPosixPath(outputPath)
    }

    return {
      banner: {
        data: {
          author: 'webpack-dts-example',
          source: includeGlobs,
          overview: createBannerOverview(stats)
        }
      },
      files: [{ path: outputPath, content: renderDts(entries) }]
    }
  }
}

module.exports = { createWebpackDtsDerive }
