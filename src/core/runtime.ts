import fg from 'fast-glob'
import path from 'node:path'
import { resolveOptions } from './options.js'
import { PLUGIN_NAME } from './constants.js'
import { emitResultFiles } from './emitter.js'
import { loadChangeContent } from './loader.js'
import { normalizeIncomingPath, toRelPath } from './path.js'
import { createQueueState, mergeChangeType } from './queue.js'
import type { DeriveChange, DeriveEvent, DerivePluginOptions } from '../types.js'

type Runtime = {
  runFull: () => Promise<void>
  runPatch: (changes: DeriveChange[]) => Promise<void>
}

export function createDeriveRuntime(userOptions: DerivePluginOptions): Runtime {
  const { root, watch, verbose, load, derive } = resolveOptions(userOptions)
  const watchedFileSet = new Set<string>()
  const queueState = createQueueState()

  const isWatchedPath = (relPath: string): boolean => watch.some(pattern => path.matchesGlob(relPath, pattern))

  const log = (message: string) => {
    if (verbose) console.warn(`[${PLUGIN_NAME}] ${message}`)
  }

  async function refreshWatchedSet(): Promise<string[]> {
    const files = await fg(watch, { cwd: root, onlyFiles: true, absolute: true })
    watchedFileSet.clear()
    const relFiles = files.map(v => toRelPath(root, v)).sort()
    for (const rel of relFiles) watchedFileSet.add(rel)
    return relFiles
  }

  async function dispatch(event: DeriveEvent): Promise<void> {
    const loadedChanges = await Promise.all(
      event.changes.map(change => loadChangeContent(root, change, load, log))
    )
    const loadedEvent: DeriveEvent = { ...event, changes: loadedChanges }
    const result = await derive(loadedEvent)
    await emitResultFiles(root, watchedFileSet, result, log)
  }

  async function consumeQueue(): Promise<void> {
    if (queueState.running) return
    queueState.running = true
    try {
      while (true) {
        if (queueState.pendingFull) {
          queueState.pendingFull = false
          const relFiles = await refreshWatchedSet()
          const fullChanges: DeriveChange[] = relFiles.map(rel => ({
            type: 'unknown',
            path: rel
          }))
          await dispatch({ type: 'full', changes: fullChanges })
          continue
        }
        if (queueState.pendingPatchChanges.size > 0) {
          const patchChanges = [...queueState.pendingPatchChanges.values()].sort((a, b) =>
            a.path.localeCompare(b.path)
          )
          queueState.pendingPatchChanges.clear()
          await dispatch({ type: 'patch', changes: patchChanges })
          continue
        }
        break
      }
    } finally {
      queueState.running = false
    }
  }

  async function runFull(): Promise<void> {
    queueState.pendingFull = true
    queueState.pendingPatchChanges.clear()
    await consumeQueue()
  }

  async function runPatch(changes: DeriveChange[]): Promise<void> {
    for (const change of changes) {
      const relPath = normalizeIncomingPath(root, change.path)
      if (!relPath) continue
      if (!isWatchedPath(relPath)) continue
      const prev = queueState.pendingPatchChanges.get(relPath)
      const mergedType = prev ? mergeChangeType(prev.type, change.type) : change.type
      queueState.pendingPatchChanges.set(relPath, {
        type: mergedType,
        path: relPath,
        timestamp: change.timestamp ?? prev?.timestamp
      })
      if (mergedType === 'delete') watchedFileSet.delete(relPath)
      else watchedFileSet.add(relPath)
    }
    await consumeQueue()
  }

  return { runFull, runPatch }
}
