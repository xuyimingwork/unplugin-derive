import { ensureGitignoreEntries } from './gitignore.js'
import { filterEmittableFiles } from './emitter.js'
import { normalizeSlashes, toRelPath } from './path.js'
import type { DeriveOptions, DeriveResult, GitignoreMatcher } from '@/types'

type NormalizedGitignore = {
  matcher: GitignoreMatcher | undefined
  entries: string[]
} | undefined

function normalizeGitignore(
  gitignoreInput: DeriveOptions['gitignore'],
  {
    log
  }: {
    log: (message: string) => void
  }
): NormalizedGitignore {
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
    .filter((v): v is string => typeof v === 'string')
    .map(v => normalizeSlashes(v.trim()))
    .filter(Boolean)
  return {
    matcher: undefined,
    entries
  }
}

export function createPrepareGitignore(
  gitignoreInput: DeriveOptions['gitignore'],
  {
    log,
    root,
    watch
  }: {
    log: (message: string) => void
    root: string
    watch: string[]
  }
): (result: DeriveResult) => Promise<void> {
  const normalizedGitignore = normalizeGitignore(gitignoreInput, { log })
  const gitignore = normalizedGitignore?.matcher
  const gitignoreEntries = normalizedGitignore?.entries || []
  if (!gitignore && gitignoreEntries.length === 0) {
    return async () => {}
  }
  return async (result: DeriveResult) => {
    const files = Array.isArray(result.files) ? result.files : []
    const { emittable } = filterEmittableFiles(files, { root, watch })
    const relPathsFromFiles = emittable
      .filter((file): file is { path: string; content: string } => 'content' in file)
      .map(file => toRelPath(root, file.path))
      .filter(Boolean)
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

