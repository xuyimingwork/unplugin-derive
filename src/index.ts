import { createUnplugin } from 'unplugin'
import { createDeriveRuntime } from './core/runtime.js'
import type { DeriveChangeType, DerivePluginOptions } from './types.js'

function mapWatchEventType(event: unknown): DeriveChangeType {
  if (event === 'create' || event === 'update' || event === 'delete') return event
  return 'unknown'
}

export const unpluginDerive = createUnplugin<DerivePluginOptions | undefined>(
  userOptions => {
    if (!userOptions) throw new Error('unplugin-derive options are required.')
    const runtime = createDeriveRuntime(userOptions)
    return {
      name: 'unplugin-derive',
      buildStart() {
        return runtime.runFull()
      },
      watchChange(id: string, change?: { event?: string }) {
        if (!id) return runtime.runFull()
        return runtime.runPatch([
          {
            type: mapWatchEventType(change?.event),
            path: id
          }
        ])
      }
    }
  }
)

export const vite = unpluginDerive.vite
export const rollup = unpluginDerive.rollup
export const webpack = unpluginDerive.webpack
export const esbuild = unpluginDerive.esbuild

export type { DerivePluginOptions } from './types.js'

