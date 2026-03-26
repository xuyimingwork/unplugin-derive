import { removeIfExists, writeIfChanged } from './fs.js'
import { isWithinRoot, normalizeRelPath, toAbsPath } from './path.js'
import type { EmitResult } from '../types.js'

export async function emitResultFiles(
  root: string,
  watchedFileSet: Set<string>,
  result: EmitResult,
  log: (message: string) => void
): Promise<void> {
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files) {
    const relPath = normalizeRelPath(file.path)
    if (!relPath) continue
    if (watchedFileSet.has(relPath)) {
      log(`skip emit ${relPath} (target is watched)`)
      continue
    }
    const absPath = toAbsPath(root, relPath)
    if (!isWithinRoot(root, absPath)) {
      log(`skip emit ${relPath} (outside root)`)
      continue
    }
    if ('type' in file && file.type === 'delete') {
      removeIfExists(absPath)
    } else if ('content' in file) {
      writeIfChanged(absPath, file.content)
    }
  }
}
