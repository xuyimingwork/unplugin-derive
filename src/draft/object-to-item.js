const { getObjectPropertyKey, astNodeToDisplayString } = require('./ast-value')

/**
 * object 字面量 → 扁平记录（method 须为字符串字面量）
 * @returns {Record<string, string> | null}
 */
function objectExpressionToItemRecord(objExpr) {
  const out = {}
  let methodOk = false
  for (const prop of objExpr.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue
    const key = getObjectPropertyKey(prop)
    if (key == null) continue
    if (key === 'method' && prop.value.type === 'StringLiteral') {
      out.method = prop.value.value
      methodOk = true
      continue
    }
    const disp = astNodeToDisplayString(prop.value)
    if (disp !== undefined) out[key] = disp
  }
  if (!methodOk || !out.method) return null
  return out
}

module.exports = {
  objectExpressionToItemRecord
}
