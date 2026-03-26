/** AST 字面量 / 模板串 → JSDoc 可用字符串；不可静态则 [dynamic] */

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
  if (prop.key.type === 'Identifier') return prop.key.name
  if (prop.key.type === 'StringLiteral') return prop.key.value
  return null
}

function trySerializeObjectDeep(objExpr, depth = 0) {
  if (depth > 8) return null
  const o = {}
  for (const prop of objExpr.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue
    const key = getObjectPropertyKey(prop)
    if (key == null) return null
    const ser = valueNodeToJsonish(prop.value, depth + 1)
    if (ser === undefined) return null
    o[key] = ser
  }
  return o
}

function trySerializeArrayDeep(arrExpr, depth = 0) {
  if (depth > 8) return null
  const out = []
  for (const el of arrExpr.elements) {
    if (el == null) continue
    const ser = valueNodeToJsonish(el, depth + 1)
    if (ser === undefined) return null
    out.push(ser)
  }
  return out
}

function valueNodeToJsonish(node, depth) {
  if (!node) return undefined
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
      const o = trySerializeObjectDeep(node, depth)
      return o === null ? undefined : o
    }
    case 'ArrayExpression': {
      const a = trySerializeArrayDeep(node, depth)
      return a === null ? undefined : a
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
      const o = trySerializeObjectDeep(node, 0)
      return o !== null ? JSON.stringify(o) : '[dynamic]'
    }
    case 'ArrayExpression': {
      const a = trySerializeArrayDeep(node, 0)
      return a !== null ? JSON.stringify(a) : '[dynamic]'
    }
    default:
      return '[dynamic]'
  }
}

module.exports = {
  templateToDisplay,
  getObjectPropertyKey,
  trySerializeObjectDeep,
  trySerializeArrayDeep,
  valueNodeToJsonish,
  astNodeToDisplayString
}
