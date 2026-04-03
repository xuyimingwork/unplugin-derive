import { createUnplugin } from 'unplugin'
import { logger } from './core/logger.js'
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
    logger.plugin.info('plugin inited')
    return {
      name: 'unplugin-derive',
      buildStart() {
        if (options.deriveWhen.buildStart === 'none') {
          logger.plugin.info('trigger skipped: deriveWhen.buildStart=none')
          return
        }
        logger.plugin.info('trigger full derive via buildStart')
        return runtime.run({ type: 'full', changes: [] })
      },
      watchChange(id: string, change?: { event?: string }) {
        if (options.deriveWhen.watchChange === 'none') {
          logger.plugin.info('trigger skipped: deriveWhen.watchChange=none')
          return
        }
        if (options.deriveWhen.watchChange === 'full') {
          logger.plugin.info('trigger full derive via watchChange')
          return runtime.run({ type: 'full', changes: [] })
        }
        logger.plugin.info('trigger patch derive via watchChange', mapWatchEventType(change?.event), id)
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

export type { DeriveOptions as DerivePluginOptions } from './types.js'

