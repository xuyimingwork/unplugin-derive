import fg from 'fast-glob'
import { createEmit } from './emitter.js'
import { createPrepareGitignore } from './gitignore-resolver.js'
import { isPathWatched, normalizeIncomingAbsPath } from './path.js'
import type { DeriveChange, DeriveEvent } from '../types.js'
import type { DeriveOptionLoadResolved } from './load-resolver.js'
import type { DeriveOptionsResolved } from './options.js'
import type { DeriveTask } from './queue.js'
import type { Emit } from './emitter.js'

export type DeriveContext = {
  log: (message: string) => void
  load: (task: DeriveTask) => Promise<DeriveEvent>
  derive: DeriveOptionsResolved['derive']
  postDerive: (result: Parameters<Emit>[0]) => Promise<void>
  emit: Emit
}

type RuntimeHooks = Pick<DeriveContext, 'postDerive' | 'emit'>

async function getWatchedFiles(watches: string[]): Promise<string[]> {
  const files = await fg(watches, { onlyFiles: true, absolute: true })
  return files.sort()
}

async function getFullChanges(watches: string[]): Promise<DeriveChange[]> {
  const absPaths = await getWatchedFiles(watches)
  return absPaths.map(absPath => ({
    type: 'unknown',
    path: absPath
  }))
}

function normalizePatchChanges(root: string, changes: DeriveChange[]): DeriveChange[] {
  return changes
    .map(change => ({
      ...change,
      path: normalizeIncomingAbsPath(root, change.path),
    }))
    .filter(change => change.path !== '')
}

function filterWatchedChanges(watches: string[], changes: DeriveChange[]): DeriveChange[] {
  return changes.filter(change => isPathWatched(change.path, watches))
}

async function loadChanges(changes: DeriveChange[], load: DeriveOptionLoadResolved): Promise<DeriveChange[]> {
  return Promise.all(
    changes.map(async change => {
      const result = await load(change.path)
      if (!result || typeof result !== 'object' || !('content' in result)) return change
      return { ...change, content: result.content, loader: result.loader }
    })
  )
}

export function createDeriveContext(options: DeriveOptionsResolved): DeriveContext {
  const hooks = createRuntimeHooks(options)
  const { log, derive } = options
  const load = createTaskLoad(options)
  return {
    log,
    derive,
    ...hooks,
    load
  }
}

function createRuntimeHooks(options: DeriveOptionsResolved): RuntimeHooks {
  const { root, watch, log, gitignore } = options
  return {
    postDerive: createPrepareGitignore(gitignore, { root, watch, log }),
    emit: createEmit({ root, watch, log })
  }
}

function createTaskLoad(options: DeriveOptionsResolved): DeriveContext['load'] {
  const { root, watch, log, load } = options
  return async task => {
    const rawChanges = task.type === 'full'
      ? await getFullChanges(watch)
      : getPatchChanges(task.changes, { root, watch, log })
    return {
      type: task.type,
      changes: await loadChanges(rawChanges, load)
    }
  }
}

function getPatchChanges(
  changes: DeriveChange[],
  { root, watch, log }: { root: string; watch: string[]; log: (message: string) => void }
): DeriveChange[] {
  const normalizedChanges = normalizePatchChanges(root, changes)
  if (normalizedChanges.length !== changes.length) {
    log(`skip patch changes outside root (${changes.length - normalizedChanges.length}/${changes.length})`)
  }
  const watchedChanges = filterWatchedChanges(watch, normalizedChanges)
  if (watchedChanges.length !== normalizedChanges.length) {
    log(`skip patch changes not watched (${normalizedChanges.length - watchedChanges.length}/${normalizedChanges.length})`)
  }
  return watchedChanges
}
