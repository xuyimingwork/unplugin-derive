import path from 'node:path'
import { PLUGIN_NAME } from './constants.js'
import { ensureGitignoreEntries } from './gitignore.js'
import { normalizeRelPath, normalizeSlashes, toRelPath } from './path.js'
import { createLoadResolver } from './load-resolver.js'
import { createDeriveResolver } from './derive-resolver.js'
import type { DeriveBuildStartType, DerivePluginOptions, DeriveWatchChangeType, DeriveResult, GitignoreMatcher, DeriveOptionLoadResolved, DeriveResolved } from '../types.js'

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

function createPrepareGitignore(
  root: string,
  gitignoreInput: DerivePluginOptions['gitignore'],
  log: (message: string) => void
): (result: DeriveResult) => Promise<void> {
  const normalizedGitignore = normalizeGitignore(gitignoreInput, { log })
  const gitignore = normalizedGitignore?.matcher
  const gitignoreEntries = normalizedGitignore?.entries || []
  if (!gitignore && gitignoreEntries.length === 0) {
    return async () => {}
  }
  return async (result: DeriveResult) => {
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
    banner: userOptions.banner,
  })
  return { root, watch, log, load, derive, prepareGitignore, deriveWhen }
}

