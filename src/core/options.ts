import path from 'node:path'
import { PLUGIN_NAME } from './constants.js'
import { createPrepareGitignore } from './gitignore-resolver.js'
import { createEmit } from './emitter.js'
import { normalizeRelPath, normalizeSlashes, toRelPath } from './path.js'
import { createLoadResolver } from './load-resolver.js'
import { createDeriveResolver } from './derive-resolver.js'
import type { DeriveBuildStartType, DerivePluginOptions, DeriveWatchChangeType, DeriveOptionLoadResolved, DeriveResolved, DeriveResult } from '../types.js'
import type { Emit } from './emitter.js'

export type DeriveWhenResolved = {
  buildStart: DeriveBuildStartType
  watchChange: DeriveWatchChangeType
}

export type ResolvedDeriveOptions = {
  root: string
  watch: string[]
  log: (message: string) => void
  load: DeriveOptionLoadResolved
  derive: DeriveResolved
  prepareGitignore: (result: DeriveResult) => Promise<void>
  emit: Emit
  deriveWhen: DeriveWhenResolved
}

function normalizeRoot(rootInput: DerivePluginOptions['root']): string {
  return path.resolve(rootInput ?? process.cwd())
}

function normalizeWatch(watchInput: DerivePluginOptions['watch'], root: string): string[] {
  const watchRel = (Array.isArray(watchInput) ? watchInput : [watchInput])
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean)
  if (!watchRel.length) throw new Error('`watch` must contain at least one non-empty pattern.')
  return watchRel.map(pattern => {
    const isNegated = pattern.startsWith('!')
    const rawPattern = isNegated ? pattern.slice(1) : pattern
    const normalizedPattern = normalizeSlashes(path.resolve(root, normalizeRelPath(rawPattern)))
    return isNegated ? `!${normalizedPattern}` : normalizedPattern
  })
}

function normalizeVerbose(verboseInput: DerivePluginOptions['verbose']): boolean {
  return verboseInput === true
}

function normalizeDeriveWhen(deriveWhenInput: DerivePluginOptions['deriveWhen']): DeriveWhenResolved {
  return {
    buildStart: deriveWhenInput?.buildStart ?? 'full',
    watchChange: deriveWhenInput?.watchChange ?? 'patch'
  }
}

function createLogger(verbose: boolean): (message: string) => void {
  return message => {
    if (verbose) console.warn(`[${PLUGIN_NAME}] ${message}`)
  }
}

export function resolveOptions(userOptions: DerivePluginOptions): ResolvedDeriveOptions {
  if (typeof userOptions.derive !== 'function') {
    throw new Error('`derive` is required and must be a function.')
  }
  const root = normalizeRoot(userOptions.root)
  const watch = normalizeWatch(userOptions.watch, root)
  const verbose = normalizeVerbose(userOptions.verbose)
  const deriveWhen = normalizeDeriveWhen(userOptions.deriveWhen)
  const log = createLogger(verbose)
  const load = createLoadResolver(userOptions.load, { root, log })
  const prepareGitignore = createPrepareGitignore(userOptions.gitignore, { root, watch, log })
  const emit = createEmit({ root, watch, log })
  const derive = createDeriveResolver(userOptions.derive, {
    root,
    banner: userOptions.banner,
  })
  return { root, watch, log, load, derive, prepareGitignore, emit, deriveWhen }
}

