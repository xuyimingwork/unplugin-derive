import fg from 'fast-glob'
import { createEmit } from './emitter.js'
import { createPrepareGitignore } from './gitignore-resolver.js'
import { isPathWatched, normalizeIncomingAbsPath } from './path.js'
import type { DeriveChange, DeriveEvent, DeriveOptionLoadResolved } from '../types.js'
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
  const { root, watch, log, load, derive, gitignore } = options
  const postDerive = createPrepareGitignore(gitignore, { root, watch, log })
  const emit = createEmit({ root, watch, log })
  return {
    log,
    derive,
    postDerive,
    emit,
    async load(task) {
      const rawChanges = task.type === 'full'
        ? await getFullChanges(watch)
        : filterWatchedChanges(watch, normalizePatchChanges(root, task.changes))
      return {
        type: task.type,
        changes: await loadChanges(rawChanges, load)
      }
    }
  }
}
