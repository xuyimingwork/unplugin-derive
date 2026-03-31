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
  const { root, watch, log, load, derive, prepareGitignore } = options

  async function executeTask(task: DeriveTask): Promise<void> {
    const startedAt = Date.now()
    let stage = 'resolve changes'
    try {
      const changes = task.type === 'full'
        ? await getFullChanges(task.watches)
        : task.changes
      if (task.type === 'patch' && changes.length === 0) {
        log('skip derive task (patch has no changes)')
        return
      }
      log(`start derive task (${task.type}, changes=${changes.length})`)
      stage = 'load content'
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
      stage = 'derive'
      const result = await derive(event)
      stage = 'prepare gitignore'
      await prepareGitignore(result)
      stage = 'emit files'
      const summary = await emitResultFiles(result)
      const elapsed = Date.now() - startedAt
      log(`done derive task (${task.type}) written=${summary.written}, deleted=${summary.deleted}, skipped=${summary.skipped}, duration=${elapsed}ms`)
    } catch (e: any) {
      const elapsed = Date.now() - startedAt
      log(`derive task failed at ${stage} (${task.type}, duration=${elapsed}ms): ${e?.message || e}`)
      throw e
    }
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
