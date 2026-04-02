import { removeIfExists, writeIfChanged } from './fs.js'
import { renderBannerForFile } from './banner.js'
import type { DeriveResult } from '../types.js'

export type EmitSummary = {
  written: number
  deleted: number
  skipped: number
}

export async function emitResultFiles(
  result: DeriveResult,
): Promise<EmitSummary> {
  const summary: EmitSummary = {
    written: 0,
    deleted: 0,
    skipped: 0
  }
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files) {
    const absPath = file.path
    if ('type' in file && file.type === 'delete') {
      const removed = await removeIfExists(absPath)
      if (removed) summary.deleted += 1
      else summary.skipped += 1
    } else if ('content' in file) {
      const banner = renderBannerForFile(file.banner, { path: file.path, content: file.content })
      const written = await writeIfChanged(absPath, `${banner}${file.content}`)
      if (written) summary.written += 1
      else summary.skipped += 1
    }
  }
  return summary
}
