import { logger } from './logger.js'
import type { DeriveBanner, DeriveEvent, DeriveOptionDerive, DeriveResultFile, DeriveResultResolved } from '@/types'
import { normalizeRelPath, normalizeSlashes, toAbsPath, toRelPath } from './path'
import { getBanner } from './banner/banner'

export type DeriveResolved = (event: DeriveEvent) => Promise<DeriveResultResolved>

function isDeleteDeriveFile(file: DeriveResultFile): file is Extract<DeriveResultFile, { type: 'delete' }> {
  return 'type' in file && file.type === 'delete'
}

export function createDeriveResolver(
  derive: DeriveOptionDerive,
  {
    root,
    banner
  }: {
    root: string
    banner?: DeriveBanner
  }
): DeriveResolved {
  return async (event: DeriveEvent) => {
    logger.runtime.debug(`user derive: ${event.type} (${event.changes.length} changes)`)
    const derived = await derive({
      ...event,
      changes: event.changes.map(change => ({
        ...change,
        path: toRelPath(root, change.path)
      }))
    })

    if (!derived || typeof derived !== 'object') {
      logger.runtime.debug('derive returned empty or invalid result')
      return { files: [] }
    }
    if (!Array.isArray(derived.files) || !derived.files.length) {
      logger.runtime.debug('derive returned empty file list')
      return { files: [] }
    }

    const result = {
      files: derived.files.map(file => {
        const path = normalizeSlashes(toAbsPath(root, normalizeRelPath(file.path)))
        if (isDeleteDeriveFile(file)) return { ...file, path }
        const prefix = getBanner(
          [banner, derived.banner, file.banner],
          { path: file.path, content: file.content }
        )
        return {
          path,
          content: `${prefix}${file.content}`
        }
      })
    }

    logger.runtime.debug(`derive resolved ${result.files.length} files`)
    return result
  }
}

