/**
 * 解析 export default：直接数组字面量，或指向顶层 const/let/var 初始化为数组的变量
 */

function collectArrayBindings(program) {
  const map = new Map()
  for (const stmt of program.body) {
    if (stmt.type !== 'VariableDeclaration') continue
    if (!['const', 'let', 'var'].includes(stmt.kind)) continue
    for (const d of stmt.declarations) {
      if (
        d.id.type === 'Identifier' &&
        d.init &&
        d.init.type === 'ArrayExpression'
      ) {
        map.set(d.id.name, d.init)
      }
    }
  }
  return map
}

function resolveDefaultExportArray(program) {
  const bindings = collectArrayBindings(program)
  for (const stmt of program.body) {
    if (stmt.type !== 'ExportDefaultDeclaration') continue
    const decl = stmt.declaration
    if (decl.type === 'ArrayExpression') return decl
    if (decl.type === 'Identifier') return bindings.get(decl.name) || null
    return null
  }
  return null
}

module.exports = {
  collectArrayBindings,
  resolveDefaultExportArray
}
