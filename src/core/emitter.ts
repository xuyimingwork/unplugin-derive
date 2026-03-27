import { removeIfExists, writeIfChanged } from './fs.js'
import { renderBannerForFile } from './banner.js'
import type { EmitResult } from '../types.js'

export async function emitResultFiles(
  result: EmitResult,
): Promise<void> {
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files) {
    const absPath = file.path
    if ('type' in file && file.type === 'delete') {
      await removeIfExists(absPath)
    } else if ('content' in file) {
      const banner = renderBannerForFile(file.banner, { path: file.path, content: file.content })
      await writeIfChanged(absPath, `${banner}${file.content}`)
    }
  }
}
