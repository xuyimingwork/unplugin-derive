import path from 'node:path'
import micromatch from 'micromatch'
import { PLUGIN_NAME } from './constants.js'
import { isWithinRoot, normalizeRelPath, normalizeSlashes, toAbsPath, toRelPath } from './path.js'
import { applyBuiltinLoader } from './builtin-loader.js'
import type { DerivePluginOptions, EmitResult, LoadResult } from '../types.js'

function normalizeRoot(rootInput: DerivePluginOptions['root']): string {
  return path.resolve(rootInput ?? process.cwd())
}

function normalizeWatch(watchInput: DerivePluginOptions['watch'], root: string): string[] {
  const watchRel = (Array.isArray(watchInput) ? watchInput : [watchInput])
    .map(v => normalizeRelPath(String(v)))
    .filter(Boolean)
  if (!watchRel.length) throw new Error('`watch` must contain at least one non-empty pattern.')
  return watchRel.map(pattern => normalizeSlashes(path.resolve(root, pattern)))
}

function normalizeVerbose(verboseInput: DerivePluginOptions['verbose']): boolean {
  return verboseInput === true
}

function createLogger(verbose: boolean): (message: string) => void {
  return message => {
    if (verbose) console.warn(`[${PLUGIN_NAME}] ${message}`)
  }
}

function isPathWatched(path: string, watches: string[]): boolean {
  const normalized = normalizeSlashes(path)
  return watches.some(pattern => micromatch.isMatch(normalized, pattern))
}

function createLoadResolver(
  userLoad: DerivePluginOptions['load'],
  {
    root,
    log,
  }: {
    root: string
    log: (message: string) => void
  }
): NonNullable<DerivePluginOptions['load']> {
  if (!userLoad) {
    return async () => undefined
  }
  return async absPath => {
    let result: LoadResult
    try {
      result = await userLoad(toRelPath(root, absPath))
    } catch (e: any) {
      log(`load failed for ${absPath}: ${e?.message || e}`)
      return undefined
    }
    if (result == null) return undefined
    if (typeof result === 'string') {
      try {
        const content = await applyBuiltinLoader(absPath, result)
        return { content }
      } catch (e: any) {
        if (e?.code !== 'ENOENT') log(`built-in load(${result}) failed for ${absPath}: ${e?.message || e}`)
        return undefined
      }
    }
    return result
  }
}

function createDeriveResolver(
  userDerive: DerivePluginOptions['derive'],
  {
    root,
    watch,
    log,
  }: {
    root: string
    watch: string[]
    log: (message: string) => void
  }
): DerivePluginOptions['derive'] {
  return async event => {
    const userEvent = {
      ...event,
      changes: event.changes.map(change => ({
        ...change,
        path: toRelPath(root, change.path)
      }))
    }
    const result = await userDerive(userEvent)
    const files = (Array.isArray(result.files) ? result.files : [])
      .map(file => ({
        ...file,
        path: normalizeSlashes(toAbsPath(root, normalizeRelPath(file.path)))
      }))
      .filter(file => {
        const absPath = file.path
        const relPath = toRelPath(root, absPath)
        if (!relPath || !isWithinRoot(root, absPath)) {
          log(`skip emit ${absPath} (outside root)`)
          return false
        }
        if (isPathWatched(absPath, watch)) {
          log(`skip emit ${relPath} (target is watched)`)
          return false
        }
        return true
      })
    const normalizedResult: EmitResult = { ...result, files }
    return normalizedResult
  }
}

export function resolveOptions(userOptions: DerivePluginOptions): {
  root: string
  watch: string[]
  load: NonNullable<DerivePluginOptions['load']>
  derive: DerivePluginOptions['derive']
} {
  if (typeof userOptions.derive !== 'function') {
    throw new Error('`derive` is required and must be a function.')
  }
  const root = normalizeRoot(userOptions.root)
  const watch = normalizeWatch(userOptions.watch, root)
  const verbose = normalizeVerbose(userOptions.verbose)
  const log = createLogger(verbose)
  const load = createLoadResolver(userOptions.load, { root, log })
  const derive = createDeriveResolver(userOptions.derive, { root, watch, log })
  return { root, watch, load, derive }
}

