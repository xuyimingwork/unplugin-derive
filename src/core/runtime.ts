import fg from 'fast-glob'
import { resolveOptions } from './options.js'
import { emitResultFiles } from './emitter.js'
import { loadChangeContent } from './loader.js'
import { normalizeIncomingAbsPath } from './path.js'
import { createQueueState, scheduleTask } from './queue.js'
import type { DeriveChange, DeriveEvent, DerivePluginOptions } from '../types.js'
import type { DeriveTask } from './queue.js'

type Runtime = {
  run: (event: DeriveEvent) => Promise<void>
}

export function createDeriveRuntime(userOptions: DerivePluginOptions): Runtime {
  const { root, watch, load, derive } = resolveOptions(userOptions)
  const queueState = createQueueState()

  async function listWatchedFiles(): Promise<string[]> {
    const files = await fg(watch, { onlyFiles: true, absolute: true })
    return files.sort()
  }

  async function dispatch(event: DeriveEvent): Promise<void> {
    const loadedChanges = await Promise.all(
      event.changes.map(change =>
        loadChangeContent(
          change.path,
          change.type,
          change.timestamp,
          load
        )
      )
    )
    const loadedEvent: DeriveEvent = { ...event, changes: loadedChanges }
    const result = await derive(loadedEvent)
    await emitResultFiles(result)
  }

  async function executeTask(task: DeriveTask): Promise<void> {
    if (task.type === 'full') {
      const absFiles = await listWatchedFiles()
      const fullChanges: DeriveChange[] = absFiles.map(absPath => ({
        type: 'unknown',
        path: absPath
      }))
      await dispatch({ type: 'full', changes: fullChanges })
      return
    }
    if (task.changes.length === 0) return
    await dispatch({ type: 'patch', changes: task.changes })
  }

  async function run(event: DeriveEvent): Promise<void> {
    if (event.type === 'full') {
      await scheduleTask(queueState, { type: 'full' }, executeTask)
      return
    }
    const normalizedChanges: DeriveChange[] = []
    const changes = event.changes
    for (const change of changes) {
      const absPath = normalizeIncomingAbsPath(root, change.path)
      if (!absPath) continue
      normalizedChanges.push({
        ...change,
        path: absPath,
      })
    }
    await scheduleTask(queueState, { type: 'patch', changes: normalizedChanges }, executeTask)
  }

  return { run }
}
