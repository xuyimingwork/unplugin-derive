import type { DeriveBanner, DeriveOptionDerive, DeriveResolved, DerivePluginOptions, DeriveResult, DeriveResultFile } from '../types.js'
import { normalizeRelPath, normalizeSlashes, toAbsPath, toRelPath } from './path.js'
import type { DeriveEvent } from '../types.js'
import { getBanner } from './banner.js'

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
    const derived = await derive({
      ...event,
      changes: event.changes.map(change => ({
        ...change,
        path: toRelPath(root, change.path)
      }))
    })

    if (!derived || typeof derived !== 'object') return { files: [] }
    if (!Array.isArray(derived.files) || !derived.files.length) return { files: [] }

    return {
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
  }
}

