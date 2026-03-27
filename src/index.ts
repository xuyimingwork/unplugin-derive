import { createUnplugin } from 'unplugin'
import { resolveOptions } from './core/options.js'
import { isPathWatched, normalizeIncomingAbsPath } from './core/path.js'
import { createDeriveRuntime } from './core/runtime.js'
import type { DeriveChangeType, DerivePluginOptions } from './types.js'

function mapWatchEventType(event: unknown): DeriveChangeType {
  if (event === 'create' || event === 'update' || event === 'delete') return event
  return 'unknown'
}

export const unpluginDerive = createUnplugin<DerivePluginOptions | undefined>(
  userOptions => {
    if (!userOptions) throw new Error('unplugin-derive options are required.')
    const options = resolveOptions(userOptions)
    const runtime = createDeriveRuntime(options)
    return {
      name: 'unplugin-derive',
      buildStart() {
        if (options.deriveWhen.buildStart === 'none') return
        return runtime.run({ type: 'full', changes: [] })
      },
      watchChange(id: string, change?: { event?: string }) {
        if (options.deriveWhen.watchChange === 'none') return
        const absPath = normalizeIncomingAbsPath(options.root, id)
        if (!absPath || !isPathWatched(absPath, options.watch)) return
        if (options.deriveWhen.watchChange === 'full') {
          return runtime.run({ type: 'full', changes: [] })
        }
        return runtime.run({
          type: 'patch',
          changes: [
            {
              type: mapWatchEventType(change?.event),
              path: id
            }
          ]
        })
      }
    }
  }
)

export const vite = unpluginDerive.vite
export const rollup = unpluginDerive.rollup
export const webpack = unpluginDerive.webpack
export const esbuild = unpluginDerive.esbuild

export type { DerivePluginOptions } from './types.js'

