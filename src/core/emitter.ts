import type { DeriveResult, DeriveResultFile } from '@/types'
import { logger } from './logger.js'
import { removeIfExists, writeIfChanged } from './fs'
import { isPathWatched, isWithinRoot, toRelPath } from './path'

export type EmitNoopSample = {
  relPath: string
  kind: 'content_identical' | 'delete_absent'
}

export type EmitSummary = {
  written: number
  deleted: number
  /** Emittable paths where write/delete was a no-op (unchanged content or delete if missing). */
  skipped: number
  /** Write: on-disk UTF-8 equals derived string. */
  skippedContentIdentical: number
  /** Delete: target path did not exist. */
  skippedDeleteAbsent: number
  /** Examples for logs (capped). */
  noopSamples: EmitNoopSample[]
  /** No-ops not listed in noopSamples. */
  noopSamplesOmitted: number
  /** Count of paths in derive result before root/watch filter. */
  outputTotal: number
  /** Paths passed filter and were candidates for write/delete. */
  emittable: number
  /** Paths skipped by filter (outside root or output under watch globs). */
  filteredOut: number
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

const NOOP_SAMPLE_CAP = 5

function recordEmitNoop(summary: EmitSummary, relPath: string, kind: EmitNoopSample['kind']): void {
  summary.skipped += 1
  if (kind === 'content_identical') summary.skippedContentIdentical += 1
  else summary.skippedDeleteAbsent += 1
  if (summary.noopSamples.length < NOOP_SAMPLE_CAP) {
    summary.noopSamples.push({ relPath, kind })
  } else {
    summary.noopSamplesOmitted += 1
  }
}

export function createEmit({
  root,
  watch
}: {
  root: string
  watch: string[]
}): Emit {
  return async (result: DeriveResult) => {
    const files = Array.isArray(result.files) ? result.files : []
    const summary: EmitSummary = {
      written: 0,
      deleted: 0,
      skipped: 0,
      skippedContentIdentical: 0,
      skippedDeleteAbsent: 0,
      noopSamples: [],
      noopSamplesOmitted: 0,
      outputTotal: files.length,
      emittable: 0,
      filteredOut: 0
    }
    logger.emit.debug(`emitter input files count: ${files.length}`)
    const { emittable, skipped } = filterEmittableFiles(files, { root, watch })
    summary.emittable = emittable.length
    summary.filteredOut = skipped.length
    logger.emit.debug(`emitter emittable count: ${emittable.length}, skipped count: ${skipped.length}`)
    for (const s of skipped) {
      if (s.reason === 'outside-root') {
        logger.emit.debug(`skip emit ${s.file.path} (outside root)`)
      }
    }
    for (const file of emittable) {
      const absPath = file.path
      const relPath = toRelPath(root, absPath)
      if ('type' in file && file.type === 'delete') {
        const removed = await removeIfExists(absPath)
        if (removed === 'removed') {
          summary.deleted += 1
          logger.emit.debug(`deleted ${relPath ?? absPath}`)
        } else if (relPath) {
          recordEmitNoop(summary, relPath, 'delete_absent')
        } else {
          summary.skipped += 1
          summary.skippedDeleteAbsent += 1
        }
      } else if ('content' in file) {
        const outcome = await writeIfChanged(absPath, file.content)
        if (outcome === 'written') {
          summary.written += 1
          logger.emit.debug(`written ${relPath ?? absPath}`)
        } else if (relPath) {
          recordEmitNoop(summary, relPath, 'content_identical')
        } else {
          summary.skipped += 1
          summary.skippedContentIdentical += 1
        }
      }
    }
    return summary
  }
}

