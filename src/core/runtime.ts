import fg from 'fast-glob'
import { emitResultFiles } from './emitter.js'
import { loadChangeContent } from './loader.js'
import { normalizeIncomingAbsPath } from './path.js'
import { createTaskQueue } from './queue.js'
import type { DeriveChange, DeriveEvent } from '../types.js'
import type { ResolvedDeriveOptions } from './options.js'
import type { DeriveTask } from './queue.js'

type Runtime = {
  run: (event: DeriveEvent) => Promise<void>
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

export function createDeriveRuntime(options: ResolvedDeriveOptions): Runtime {
  const { root, watch, load, derive, prepareGitignore } = options

  async function executeTask(task: DeriveTask): Promise<void> {
    const changes = task.type === 'full'
      ? await getFullChanges(task.watches)
      : task.changes
    if (task.type === 'patch' && changes.length === 0) return
    const loadedChanges = await Promise.all(
      changes.map(change =>
        loadChangeContent(
          change.path,
          change.type,
          change.timestamp,
          load
        )
      )
    )
    const event: DeriveEvent = { type: task.type, changes: loadedChanges }
    const result = await derive(event)
    await prepareGitignore(result)
    await emitResultFiles(result)
  }
  const queue = createTaskQueue(executeTask)

  async function run(event: DeriveEvent): Promise<void> {
    if (event.type === 'full') {
      await queue.schedule({ type: 'full', watches: watch })
      return
    }
    await queue.schedule({ type: 'patch', changes: normalizePatchChanges(root, event.changes) })
  }

  return { run }
}
