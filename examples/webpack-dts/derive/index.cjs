const parser = require('@babel/parser')
const fs = require('node:fs')
const path = require('node:path')
const DEFAULT_INCLUDE = ['src/api/**/*.js']
const FALLBACK_INCLUDE_BASE = 'src/api'

function templateToDisplay(node) {
  let s = ''
  const quasis = node.quasis || []
  const exprs = node.expressions || []
  for (let i = 0; i < quasis.length; i++) {
    const q = quasis[i].value
    s += q.cooked != null ? q.cooked : q.raw
    if (i < exprs.length) s += '${...}'
  }
  return s
}

function getObjectPropertyKey(prop) {
  if (prop.key && prop.key.type === 'Identifier') return prop.key.name
  if (prop.key && prop.key.type === 'StringLiteral') return prop.key.value
  return null
}

function valueNodeToJsonish(node, depth) {
  if (!node || depth > 8) return undefined
  switch (node.type) {
    case 'StringLiteral':
      return node.value
    case 'NumericLiteral':
      return node.value
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'TemplateLiteral':
      return templateToDisplay(node)
    case 'ObjectExpression': {
      const out = {}
      for (const prop of node.properties || []) {
        if (prop.type !== 'ObjectProperty' || prop.computed) return undefined
        const key = getObjectPropertyKey(prop)
        if (key == null) return undefined
        const next = valueNodeToJsonish(prop.value, depth + 1)
        if (next === undefined) return undefined
        out[key] = next
      }
      return out
    }
    case 'ArrayExpression': {
      const out = []
      for (const el of node.elements || []) {
        if (el == null) continue
        const next = valueNodeToJsonish(el, depth + 1)
        if (next === undefined) return undefined
        out.push(next)
      }
      return out
    }
    default:
      return undefined
  }
}

function astNodeToDisplayString(node) {
  if (!node) return undefined
  switch (node.type) {
    case 'StringLiteral':
      return node.value
    case 'NumericLiteral':
      return String(node.value)
    case 'BooleanLiteral':
      return String(node.value)
    case 'NullLiteral':
      return 'null'
    case 'TemplateLiteral':
      return templateToDisplay(node)
    case 'ObjectExpression': {
      const v = valueNodeToJsonish(node, 0)
      return v === undefined ? '[dynamic]' : JSON.stringify(v)
    }
    case 'ArrayExpression': {
      const v = valueNodeToJsonish(node, 0)
      return v === undefined ? '[dynamic]' : JSON.stringify(v)
    }
    default:
      return '[dynamic]'
  }
}

function objectExpressionToItemRecord(objExpr) {
  const out = {}
  let methodOk = false
  for (const prop of objExpr.properties || []) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue
    const key =
      prop.key && prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key && prop.key.type === 'StringLiteral'
          ? prop.key.value
          : null
    if (key == null) continue
    if (key === 'method' && prop.value && prop.value.type === 'StringLiteral') {
      out.method = prop.value.value
      methodOk = true
      continue
    }
    const value = astNodeToDisplayString(prop.value)
    if (value !== undefined) out[key] = value
  }
  if (!methodOk || !out.method) return null
  return out
}

function collectArrayBindings(program) {
  const out = new Map()
  for (const stmt of program.body || []) {
    if (stmt.type !== 'VariableDeclaration') continue
    if (!['const', 'let', 'var'].includes(stmt.kind)) continue
    for (const d of stmt.declarations || []) {
      if (
        d.id &&
        d.id.type === 'Identifier' &&
        d.init &&
        d.init.type === 'ArrayExpression'
      ) {
        out.set(d.id.name, d.init)
      }
    }
  }
  return out
}

function resolveDefaultExportArray(program) {
  const bindings = collectArrayBindings(program)
  for (const stmt of program.body || []) {
    if (stmt.type !== 'ExportDefaultDeclaration') continue
    const decl = stmt.declaration
    if (decl.type === 'ArrayExpression') return decl
    if (decl.type === 'Identifier') return bindings.get(decl.name) || null
    return null
  }
  return null
}

function getExportedCategory(program) {
  for (const stmt of program.body || []) {
    if (stmt.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue
    const dec = stmt.declaration
    if (dec.type !== 'VariableDeclaration') continue
    for (const d of dec.declarations || []) {
      if (
        d.id &&
        d.id.type === 'Identifier' &&
        d.id.name === 'category' &&
        d.init &&
        d.init.type === 'StringLiteral'
      ) {
        return d.init.value
      }
    }
  }
  return undefined
}

function escapeJSDoc(text) {
  if (text == null) return ''
  return String(text).replace(/\*\//g, '* /').replace(/\r?\n/g, ' ')
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

function parseApiFile(code) {
  let ast
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'objectRestSpread',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'topLevelAwait'
      ]
    })
  } catch {
    return null
  }
  const program = ast.program
  const arr = resolveDefaultExportArray(program)
  if (!arr) return null
  const category = getExportedCategory(program)
  const items = []
  for (const el of arr.elements || []) {
    if (!el || el.type !== 'ObjectExpression') continue
    const rec = objectExpressionToItemRecord(el)
    if (rec) items.push(rec)
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

function renderDts(entries, stats) {
  const {
    filesScanned,
    methodsGenerated,
    skippedFilePaths,
    emptyFilePaths,
    duplicateMethods,
    generationStart,
    includeGlobs,
    outputRelative
  } = stats
  const escapeBlockCommentText = s => String(s).replace(/\*\//g, '*\u200b/')
  const includeText =
    Array.isArray(includeGlobs) && includeGlobs.length
      ? includeGlobs.map(escapeBlockCommentText).join('; ')
      : '(unknown)'
  const outputText = outputRelative ? escapeBlockCommentText(outputRelative) : '(unknown)'
  const header = `/**
 * This file is generated by examples/webpack-dts derive logic.
 * @fileoverview Auto generation stats
 * - include: ${includeText}
 * - output: ${outputText}
 * - scanned files: ${filesScanned}
 * - generated methods: ${methodsGenerated}
 * - skipped files: ${skippedFilePaths.length}${skippedFilePaths.length ? ` (${skippedFilePaths.map(escapeBlockCommentText).join(', ')})` : ''}
 * - empty files: ${emptyFilePaths.length}${emptyFilePaths.length ? ` (${emptyFilePaths.map(escapeBlockCommentText).join(', ')})` : ''}
 * - duplicate methods: ${duplicateMethods.length}${duplicateMethods.length ? ` (${duplicateMethods.map(v => `${escapeBlockCommentText(v.method)}: ${v.files.map(escapeBlockCommentText).join('|')}`).join(', ')})` : ''}
 * - generated at: ${formatGenerationTimeLine(Date.now() - generationStart)}
 */`

  const lines = entries.map(item => {
    const doc = item.jsdoc ? `  /**\n   * ${item.jsdoc.split('\n').join('\n   * ')}\n   */\n` : ''
    return `${doc}  ${item.method}(config?: AxiosRequestConfig): Promise<any>`
  })
  return `${header}

import type { AxiosRequestConfig } from 'axios'

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

function normalizeEntry(line) {
  return String(line || '')
    .trim()
    .replace(/^\//, '')
    .replace(/\\/g, '/')
}

function gitignoreHasEntry(content, relPosix) {
  for (const line of String(content || '').split(/\r?\n/)) {
    const n = normalizeEntry(line)
    if (!n || n.startsWith('#')) continue
    if (n === relPosix) return true
  }
  return false
}

function ensureOutputInGitignore(projectRoot, outputRelPath) {
  const rel = String(outputRelPath || '').replace(/\\/g, '/')
  if (!rel || rel.startsWith('..')) return
  const gitignorePath = path.join(projectRoot, '.gitignore')
  let content = ''
  try {
    content = fs.readFileSync(gitignorePath, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (gitignoreHasEntry(content, rel)) return
  const prefix = content && !/\n$/.test(content) ? '\n' : ''
  fs.appendFileSync(gitignorePath, `${prefix}${rel}\n`, 'utf8')
}

function createWebpackDtsDerive(input) {
  const config =
    typeof input === 'string'
      ? { outputPath: input }
      : {
          outputPath: input.outputPath,
          include: input.include,
          root: input.root,
          verbose: input.verbose === true,
          ensureGitignore: input.ensureGitignore !== false
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
  const ensureGitignore = config.ensureGitignore !== false
  const apiRoot = patternToWatchDir(projectRoot, includeGlobs[0])
  const fileContents = new Map()
  return async function derive(event) {
    if (event.type === 'full') {
      fileContents.clear()
      for (const change of event.changes) {
        if (typeof change.content === 'string') {
          fileContents.set(toPosixPath(change.path), change.content)
        }
      }
    } else {
      for (const change of event.changes) {
        if (change.type === 'delete') {
          fileContents.delete(toPosixPath(change.path))
          continue
        }
        if (typeof change.content === 'string') {
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
      const parsed = parseApiFile(content)
      if (!parsed) {
        skippedFilePaths.push(relPath)
        if (verbose) {
          console.warn(`[webpack-dts-example] skip ${relPath}: parse failed or no static export default array`)
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

    if (ensureGitignore) {
      try {
        ensureOutputInGitignore(projectRoot, toPosixPath(outputPath))
      } catch (e) {
        if (verbose) {
          console.warn(`[webpack-dts-example] write .gitignore failed: ${e.message}`)
        }
      }
    }

    return {
      files: [{ path: outputPath, content: renderDts(entries, stats) }]
    }
  }
}

module.exports = { createWebpackDtsDerive }
