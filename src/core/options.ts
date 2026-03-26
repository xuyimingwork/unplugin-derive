import path from 'node:path'
import { normalizeRelPath } from './path.js'
import type { DerivePluginOptions } from '../types.js'

export function resolveOptions(userOptions: DerivePluginOptions): {
  root: string
  watch: string[]
  verbose: boolean
  load: DerivePluginOptions['load']
  derive: DerivePluginOptions['derive']
} {
  if (typeof userOptions.derive !== 'function') {
    throw new Error('`derive` is required and must be a function.')
  }
  const root = path.resolve(userOptions.root ?? process.cwd())
  const watch = (Array.isArray(userOptions.watch) ? userOptions.watch : [userOptions.watch])
    .map(v => normalizeRelPath(String(v)))
    .filter(Boolean)
  if (!watch.length) throw new Error('`watch` must contain at least one non-empty pattern.')
  const verbose = userOptions.verbose === true
  return { root, watch, verbose, load: userOptions.load, derive: userOptions.derive }
}

