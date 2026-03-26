const fs = require('fs')
const { parseSource } = require('./parse-source')
const { resolveDefaultExportArray } = require('./resolve-default-export')
const { getExportedCategory } = require('./category')
const { objectExpressionToItemRecord } = require('./object-to-item')

/**
 * @returns {{ category?: string, items: Record<string, string>[] } | null}
 */
function parseApiFile(filePath) {
  let code
  try {
    code = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    return null
  }
  let ast
  try {
    ast = parseSource(code, filePath)
  } catch {
    return null
  }
  const program = ast.program
  const arr = resolveDefaultExportArray(program)
  if (!arr) return null
  const category = getExportedCategory(program)
  const items = []
  for (const el of arr.elements) {
    if (el == null) continue
    if (el.type !== 'ObjectExpression') continue
    const rec = objectExpressionToItemRecord(el)
    if (rec) items.push(rec)
  }
  return { category, items }
}

module.exports = {
  parseApiFile
}
