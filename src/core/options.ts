import path from 'node:path'
import { PLUGIN_NAME } from './constants.js'
import { ensureGitignoreEntries } from './gitignore.js'
import { isPathWatched, isWithinRoot, normalizeRelPath, normalizeSlashes, toAbsPath, toRelPath } from './path.js'
import { applyBuiltinLoader } from './builtin-loader.js'
import { mergeBanner } from './banner-merge.js'
import type { DeriveBuildStartType, DerivePluginOptions, DeriveWatchChangeType, EmitResult, GitignoreMatcher, LoadMethod, LoadResult } from '../types.js'

export type DeriveWhenResolved = {
  buildStart: DeriveBuildStartType
  watchChange: DeriveWatchChangeType
}

export type ResolvedDeriveOptions = {
  root: string
  watch: string[]
  log: (message: string) => void
  load: NonNullable<DerivePluginOptions['load']>
  derive: DerivePluginOptions['derive']
  prepareGitignore: (result: EmitResult) => Promise<void>
  deriveWhen: DeriveWhenResolved
}

function normalizeRoot(rootInput: DerivePluginOptions['root']): string {
  return path.resolve(rootInput ?? process.cwd())
}

function normalizeWatch(watchInput: DerivePluginOptions['watch'], root: string): string[] {
  const watchRel = (Array.isArray(watchInput) ? watchInput : [watchInput])
    .map(v => String(v).trim())
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

function normalizeGitignore(
  gitignoreInput: DerivePluginOptions['gitignore'],
  {
    log
  }: {
    log: (message: string) => void
  }
): {
  matcher: GitignoreMatcher | undefined
  entries: string[]
} | undefined {
  if (!gitignoreInput) return undefined
  if (gitignoreInput === true) {
    return { matcher: () => true, entries: [] }
  }
  if (typeof gitignoreInput === 'function') {
    return {
      matcher: file => {
        try {
          return gitignoreInput(file) === true
        } catch (e: any) {
          log(`gitignore matcher failed for ${file}: ${e?.message || e}`)
          return false
        }
      },
      entries: []
    }
  }
  const entries = (Array.isArray(gitignoreInput) ? gitignoreInput : [gitignoreInput])
    .map(v => normalizeSlashes(String(v).trim()))
    .filter(Boolean)
  return {
    matcher: undefined,
    entries
  }
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
  async function tryLoadMethod(absPath: string, method: LoadMethod): Promise<{ content: unknown } | undefined> {
    const runMethod = typeof method === 'function'
      ? method
      : async () => {
          const content = await applyBuiltinLoader(absPath, method)
          return { content }
        }
    try {
      const loaded = await runMethod()
      if (loaded && typeof loaded === 'object' && 'content' in loaded) return loaded
    } catch (e: any) {
      if (typeof method === 'function') {
        log(`custom load factory failed for ${absPath}: ${e?.message || e}`)
      } else if (e?.code !== 'ENOENT') {
        log(`built-in load(${method}) failed for ${absPath}: ${e?.message || e}`)
      }
    }
    return undefined
  }
  async function resolveLoadResult(absPath: string, result: LoadResult): Promise<{ content: unknown } | undefined> {
    if (result == null) return undefined
    if (typeof result === 'object' && !Array.isArray(result)) {
      if ('content' in result) return result
      log(`load result for ${absPath} is object without content field`)
      return undefined
    }
    if (typeof result === 'function') {
      log(`load result for ${absPath} is function; use array form to provide custom factory`)
      return undefined
    }
    const methods = Array.isArray(result) ? result : [result]
    for (const method of methods) {
      const loaded = await tryLoadMethod(absPath, method)
      if (loaded) return loaded
    }
    return undefined
  }
  return async absPath => {
    let result: LoadResult
    try {
      result = await userLoad(toRelPath(root, absPath))
    } catch (e: any) {
      log(`load failed for ${absPath}: ${e?.message || e}`)
      return undefined
    }
    return await resolveLoadResult(absPath, result)
  }
}

function createDeriveResolver(
  userDerive: DerivePluginOptions['derive'],
  {
    root,
    watch,
    banner,
    log,
  }: {
    root: string
    watch: string[]
    banner: DerivePluginOptions['banner']
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
    if (!result || typeof result !== 'object') {
      throw new Error('`derive` must return an object with `files` array.')
    }
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
    const resultBanner = mergeBanner(banner, result.banner)
    const normalizedResult: EmitResult = {
      ...result,
      banner: resultBanner,
      files: files.map(file => {
        if (!('content' in file)) return file
        return {
          ...file,
          banner: mergeBanner(resultBanner, file.banner)
        }
      })
    }
    return normalizedResult
  }
}

function createPrepareGitignore(
  root: string,
  gitignoreInput: DerivePluginOptions['gitignore'],
  log: (message: string) => void
): (result: EmitResult) => Promise<void> {
  const normalizedGitignore = normalizeGitignore(gitignoreInput, { log })
  const gitignore = normalizedGitignore?.matcher
  const gitignoreEntries = normalizedGitignore?.entries || []
  if (!gitignore && gitignoreEntries.length === 0) {
    return async () => {}
  }
  return async (result: EmitResult) => {
    const relPathsFromFiles = result.files
      .filter((file): file is { path: string; content: string } => 'content' in file)
      .map(file => toRelPath(root, file.path))
      .filter(relPath => relPath && !relPath.startsWith('..'))
    const matched = gitignore ? relPathsFromFiles.filter(relPath => gitignore(relPath)) : []
    const entries = [...gitignoreEntries, ...matched]
    if (entries.length === 0) {
      log('skip .gitignore update (no matched entries)')
      return
    }
    const summary = await ensureGitignoreEntries(root, entries)
    if (summary.appended.length === 0) {
      log(`skip .gitignore update (already present, checked ${summary.requested} entries)`)
      return
    }
    log(`updated .gitignore entries (${summary.appended.length}/${summary.requested})`)
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
  const prepareGitignore = createPrepareGitignore(root, userOptions.gitignore, log)
  const derive = createDeriveResolver(userOptions.derive, {
    root,
    watch,
    banner: userOptions.banner,
    log
  })
  return { root, watch, log, load, derive, prepareGitignore, deriveWhen }
}

