/** 从 AST 提取 export const category = '...' */
function getExportedCategory(program) {
  for (const stmt of program.body) {
    if (stmt.type !== 'ExportNamedDeclaration' || !stmt.declaration) continue
    const dec = stmt.declaration
    if (dec.type !== 'VariableDeclaration') continue
    for (const d of dec.declarations) {
      if (
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

module.exports = {
  getExportedCategory
}
