import { removeIfExists, writeIfChanged } from './fs.js'
import type { EmitResult } from '../types.js'

export async function emitResultFiles(
  result: EmitResult,
): Promise<void> {
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files) {
    const absPath = file.path
    if ('type' in file && file.type === 'delete') {
      removeIfExists(absPath)
    } else if ('content' in file) {
      writeIfChanged(absPath, file.content)
    }
  }
}
