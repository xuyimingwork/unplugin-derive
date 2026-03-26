const path = require('path')
const fg = require('fast-glob')
const { parseApiFile } = require('./parse-api-file')
const { shouldSkipFile } = require('./walk-api-files')
const { buildItemJSDoc } = require('./jsdoc')
const { patternToWatchDir } = require('./resolve-plugin-options')

/**
 * @param {string[]} includePatterns glob，相对 `projectRoot`
 * @param {string} projectRoot 工程根（glob 的 cwd）
 * @param {(rel: string, err: Error) => void} [onSkip]
 */
function collectApiDefinitions(includePatterns, projectRoot, onSkip) {
  const apiRoot = patternToWatchDir(projectRoot, includePatterns[0])

  const methodToBlocks = new Map()
  /** @type {Map<string, Set<string>>} method -> 源文件相对路径 */
  const methodToSourceFiles = new Map()

  let filesScanned = 0
  /** @type {string[]} */
  const skippedFilePaths = []
  /** @type {string[]} */
  const emptyFilePaths = []

  const files = [
    ...new Set(
      fg.sync(includePatterns, {
        cwd: projectRoot,
        absolute: true,
        onlyFiles: true
      })
    )
  ].sort()

  for (const file of files) {
    if (shouldSkipFile(apiRoot, file)) continue
    filesScanned++
    const rel = path.relative(projectRoot, file)
    const parsed = parseApiFile(file)
    if (!parsed) {
      skippedFilePaths.push(rel)
      if (typeof onSkip === 'function') {
        onSkip(rel, new Error('AST 无法解析或无静态 export default 数组'))
      }
      continue
    }
    if (!parsed.items.length) {
      emptyFilePaths.push(rel)
      continue
    }
    const { category, items } = parsed
    for (const item of items) {
      if (!item.method) continue
      const block = buildItemJSDoc(item, category, rel)
      const list = methodToBlocks.get(item.method) || []
      list.push(block)
      methodToBlocks.set(item.method, list)
      if (!methodToSourceFiles.has(item.method)) {
        methodToSourceFiles.set(item.method, new Set())
      }
      methodToSourceFiles.get(item.method).add(rel)
    }
  }

  const methods = [...methodToBlocks.keys()].sort()
  const entries = methods.map(methodName => {
    const blocks = methodToBlocks.get(methodName)
    const jsdoc = blocks.length > 1 ? blocks.join('\n---\n') : blocks[0]
    return { methodName, jsdoc }
  })

  /** @type {{ method: string, files: string[] }[]} */
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
    skippedFilePaths,
    emptyFilePaths,
    duplicateMethods
  }

  return { entries, stats }
}

module.exports = {
  collectApiDefinitions
}
