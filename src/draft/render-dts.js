const { PLUGIN_NAME } = require('./constants')
const { formatGenerationTimeLine } = require('./generation-time')

// 生成 types.d.ts 头部块注释时，打断 `*/` 序列（插入零宽字符），避免提前结束注释且不破坏 glob 可读性
function escapeBlockCommentText(s) {
  return String(s).replace(/\*\//g, '*\u200b/')
}

function formatStatsBlock(stats) {
  if (!stats) {
    return `/**
 * 本文件由 ${PLUGIN_NAME} 根据 root 与 include 匹配的 JS 模块（AST）自动生成，请勿手改。
 * 修改或新增接口配置后，保存文件或重新执行 dev/build 即可更新。
 */`
  }
  const {
    filesScanned,
    methodsGenerated,
    skippedFilePaths,
    emptyFilePaths,
    duplicateMethods,
    includeGlobs,
    outputRelative,
    _generationStart
  } = stats

  const elapsedMs =
    typeof _generationStart === 'number' ? Date.now() - _generationStart : 0
  const generatedAt = formatGenerationTimeLine(elapsedMs)

  const lines = [` *`, ` * @fileoverview 自动生成统计`]

  if (includeGlobs != null && includeGlobs.length) {
    const g = includeGlobs.map(escapeBlockCommentText).join('；')
    lines.push(` * - include：${g}`)
  }
  if (outputRelative != null) {
    lines.push(` * - output：${escapeBlockCommentText(outputRelative)}`)
  }

  lines.push(
    ` * - 扫描文件：${filesScanned}`,
    ` * - 生成方法：${methodsGenerated}`
  )

  const sk = skippedFilePaths.length
  lines.push(` * - 跳过文件：${sk}`)
  if (sk === 0) {
    lines.push(` *   - （无）`)
  } else {
    for (const p of skippedFilePaths) {
      lines.push(` *   - ${escapeBlockCommentText(p)}`)
    }
  }

  const em = emptyFilePaths.length
  lines.push(` * - 空白文件：${em}`)
  if (em === 0) {
    lines.push(` *   - （无）`)
  } else {
    for (const p of emptyFilePaths) {
      lines.push(` *   - ${escapeBlockCommentText(p)}`)
    }
  }

  const dm = duplicateMethods.length
  lines.push(` * - 重复方法：${dm}`)
  if (dm === 0) {
    lines.push(` *   - （无）`)
  } else {
    for (const { method, files } of duplicateMethods) {
      lines.push(
        ` *   - ${escapeBlockCommentText(method)}：${files
          .map(escapeBlockCommentText)
          .join('、')}`
      )
    }
  }

  lines.push(` * - 生成时间：${generatedAt}`)

  return `/**
 * 本文件由 ${PLUGIN_NAME} 根据 root 与 include 匹配的 JS 模块（AST）自动生成，请勿手改。
 * 修改或新增接口配置后，保存文件或重新执行 dev/build 即可更新。
${lines.join('\n')}
 */`
}

function renderDts(entries, stats) {
  const header = formatStatsBlock(stats)
  const lines = entries.map(({ methodName, jsdoc }) => {
    const doc = jsdoc
      ? `  /**\n   * ${jsdoc.split('\n').join('\n   * ')}\n   */\n`
      : ''
    return `${doc}  ${methodName}(config?: AxiosRequestConfig): Promise<any>`
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

module.exports = {
  renderDts,
  formatStatsBlock,
  escapeBlockCommentText
}
