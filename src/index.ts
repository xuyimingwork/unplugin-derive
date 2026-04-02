import { createUnplugin } from 'unplugin'
import { createDeriveContext } from './core/context.js'
import { resolveOptions } from './core/options.js'
import { createDeriveRuntime } from './core/runtime.js'
import type { DeriveChangeType, DeriveOptions } from './types.js'

function mapWatchEventType(event: unknown): DeriveChangeType {
  if (event === 'create' || event === 'update' || event === 'delete') return event
  return 'unknown'
}

export const unpluginDerive = createUnplugin<DeriveOptions | undefined>(
  userOptions => {
    if (!userOptions) throw new Error('unplugin-derive options are required.')
    const options = resolveOptions(userOptions)
    const runtime = createDeriveRuntime(createDeriveContext(options))
    return {
      name: 'unplugin-derive',
      buildStart() {
        if (options.deriveWhen.buildStart === 'none') return
        return runtime.run({ type: 'full', changes: [] })
      },
      watchChange(id: string, change?: { event?: string }) {
        if (options.deriveWhen.watchChange === 'none') return
        if (options.deriveWhen.watchChange === 'full') {
          return runtime.run({ type: 'full', changes: [] })
        }
        const changeType = mapWatchEventType(change?.event)
        if (changeType === 'unknown') {
          options.log(`watchChange event mapped to unknown: ${String(change?.event)}`)
        }
        return runtime.run({
          type: 'patch',
          changes: [
            {
              type: changeType,
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

export type { DeriveOptions as DerivePluginOptions } from './types.js'

