function escapeJSDoc(text) {
  if (text == null) return ''
  return String(text).replace(/\*\//g, '* /').replace(/\r?\n/g, ' ')
}

/**
 * 语义化 JSDoc：描述行 + @remarks（分类、HTTP、源文件、其它配置）
 */
function buildItemJSDoc(item, category, sourceRelPath) {
  const lines = []
  const title =
    item.name != null
      ? escapeJSDoc(item.name)
      : escapeJSDoc(item.method || '接口')
  lines.push(title)
  const remarks = []
  if (category) {
    remarks.push(`- 分类：${escapeJSDoc(category)}`)
  }
  if (item.type != null || item.url != null) {
    const verb = item.type != null ? String(item.type).toUpperCase() : ''
    const url = item.url != null ? escapeJSDoc(item.url) : ''
    remarks.push(
      verb && url
        ? `- 请求：${verb} ${url}`
        : url
        ? `- 请求地址：${url}`
        : `- 请求方式：${verb}`
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

module.exports = {
  escapeJSDoc,
  buildItemJSDoc
}
