import fg from 'fast-glob'
import { logger } from './logger.js'
import { createEmit } from './emitter'
import { createPrepareGitignore } from './gitignore-resolver'
import { isPathWatched, normalizeIncomingAbsPath } from './path'
import type { DeriveChange, DeriveEvent } from '@/types'
import type { DeriveOptionLoadResolved } from './load-resolver'
import type { DeriveOptionsResolved } from './options'
import type { DeriveTask } from './queue'
import type { Emit } from './emitter'
import { shutdownImportWorkers } from './load-import.js'

export type DeriveContext = {
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
  try {
    return await Promise.all(
      changes.map(async change => {
        const result = await load(change.path)
        if (!result || typeof result !== 'object' || !('content' in result)) return change
        return { ...change, content: result.content, loader: result.loader }
      })
    )
  } finally {
    await shutdownImportWorkers().catch(() => {})
  }
}

function countChangesWithContent(changes: DeriveChange[]): number {
  return changes.filter(c => 'content' in c).length
}

export function createDeriveContext(options: DeriveOptionsResolved): DeriveContext {
  const hooks = createRuntimeHooks(options)
  const { derive } = options
  const load = createTaskLoad(options)
  return {
    derive,
    ...hooks,
    load
  }
}

function createRuntimeHooks(options: DeriveOptionsResolved): RuntimeHooks {
  const { root, watch, gitignore } = options
  return {
    postDerive: createPrepareGitignore(gitignore, { root, watch }),
    emit: createEmit({ root, watch })
  }
}

function createTaskLoad(options: DeriveOptionsResolved): DeriveContext['load'] {
  const { root, watch, load } = options
  return async task => {
    const rawChanges = task.type === 'full'
      ? await getFullChanges(watch)
      : getPatchChanges(task.changes, { root, watch })
    logger.context.info(`load_changes: ${task.type}, ${rawChanges.length} path(s)`)
    logger.context.debug(`task ${task.type} rawChanges count: ${rawChanges.length}`)
    const loaded = await loadChanges(rawChanges, load)
    const withContent = countChangesWithContent(loaded)
    logger.context.info(`load_changes: done, ${withContent}/${loaded.length} with content`)
    if (withContent < loaded.length) {
      logger.context.debug(`load_changes: ${loaded.length - withContent} path(s) without loaded content`)
    }
    logger.context.debug(`task ${task.type} loaded changes count: ${loaded.length}`)
    return {
      type: task.type,
      changes: loaded
    }
  }
}

function getPatchChanges(
  changes: DeriveChange[],
  { root, watch }: { root: string; watch: string[] }
): DeriveChange[] {
  const normalizedChanges = normalizePatchChanges(root, changes)
  if (normalizedChanges.length !== changes.length) {
    logger.context.info(`skip patch changes outside root (${changes.length - normalizedChanges.length}/${changes.length})`)
  }
  const watchedChanges = filterWatchedChanges(watch, normalizedChanges)
  if (watchedChanges.length !== normalizedChanges.length) {
    logger.context.info(`skip patch changes not watched (${normalizedChanges.length - watchedChanges.length}/${normalizedChanges.length})`)
  }
  return watchedChanges
}
