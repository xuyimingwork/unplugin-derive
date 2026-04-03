import type { DeriveResult, DeriveResultFile } from '@/types'
import { logger } from './logger.js'
import { removeIfExists, writeIfChanged } from './fs'
import { isPathWatched, isWithinRoot, toRelPath } from './path'

export type EmitSummary = {
  written: number
  deleted: number
  skipped: number
}

export type EmitSkipReason = 'outside-root' | 'target-watched'
export type EmitSkippedFile = {
  file: DeriveResultFile
  reason: EmitSkipReason
  relPath?: string
}

export type FilterEmittableFilesResult = {
  emittable: DeriveResultFile[]
  skipped: EmitSkippedFile[]
}

export function filterEmittableFiles(
  files: DeriveResultFile[],
  {
    root,
    watch
  }: {
    root: string
    watch: string[]
  }
): FilterEmittableFilesResult {
  const emittable: DeriveResultFile[] = []
  const skipped: EmitSkippedFile[] = []
  for (const file of files) {
    const absPath = file.path
    const relPath = toRelPath(root, absPath)
    if (!relPath || !isWithinRoot(root, absPath)) {
      skipped.push({ file, reason: 'outside-root', relPath: relPath || undefined })
      continue
    }
    if (isPathWatched(absPath, watch)) {
      skipped.push({ file, reason: 'target-watched', relPath })
      continue
    }
    emittable.push(file)
  }
  return { emittable, skipped }
}

export type Emit = (result: DeriveResult) => Promise<EmitSummary>

export function createEmit({
  root,
  watch
}: {
  root: string
  watch: string[]
}): Emit {
  return async (result: DeriveResult) => {
    const summary: EmitSummary = {
      written: 0,
      deleted: 0,
      skipped: 0
    }
    const files = Array.isArray(result.files) ? result.files : []
    logger.emit.debug(`emitter input files count: ${files.length}`)
    const { emittable, skipped } = filterEmittableFiles(files, { root, watch })
    logger.emit.debug(`emitter emittable count: ${emittable.length}, skipped count: ${skipped.length}`)
    for (const s of skipped) {
      if (s.reason === 'outside-root') {
        logger.emit.info(`skip emit ${s.file.path} (outside root)`)
      } else {
        // Remove the skip for watched targets as per plan
      }
    }
    for (const file of emittable) {
      const absPath = file.path
      if ('type' in file && file.type === 'delete') {
        const removed = await removeIfExists(absPath)
        if (removed) {
          summary.deleted += 1
          logger.emit.info(`deleted ${toRelPath(root, absPath)}`)
        } else summary.skipped += 1
      } else if ('content' in file) {
        const written = await writeIfChanged(absPath, file.content)
        if (written) {
          summary.written += 1
          logger.emit.info(`written ${toRelPath(root, absPath)}`)
        } else summary.skipped += 1
      }
    }
    return summary
  }
}

