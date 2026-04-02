import { removeIfExists, writeIfChanged } from './fs.js'
import type { DeriveResult } from '../types.js'
import { isPathWatched, isWithinRoot, toRelPath } from './path.js'

export type EmitSummary = {
  written: number
  deleted: number
  skipped: number
}

export async function emitResultFiles(
  result: DeriveResult,
  {
    root,
    watch,
    log
  }: {
    root: string
    watch: string[]
    log: (message: string) => void
  }
): Promise<EmitSummary> {
  const summary: EmitSummary = {
    written: 0,
    deleted: 0,
    skipped: 0
  }
  const files = Array.isArray(result.files) ? result.files : []
  for (const file of files) {
    const absPath = file.path

    const relPath = toRelPath(root, absPath)
    if (!relPath || !isWithinRoot(root, absPath)) {
      log(`skip emit ${absPath} (outside root)`)
      continue
    }
    if (isPathWatched(absPath, watch)) {
      log(`skip emit ${relPath} (target is watched)`)
      continue
    }

    if ('type' in file && file.type === 'delete') {
      const removed = await removeIfExists(absPath)
      if (removed) summary.deleted += 1
      else summary.skipped += 1
    } else if ('content' in file) {
      const written = await writeIfChanged(absPath, file.content)
      if (written) summary.written += 1
      else summary.skipped += 1
    }
  }
  return summary
}
