import fg from 'fast-glob'
import path from 'node:path'
import { resolveOptions } from './options.js'
import { emitResultFiles } from './emitter.js'
import { ensureGitignoreEntries } from './gitignore.js'
import { loadChangeContent } from './loader.js'
import { normalizeIncomingAbsPath } from './path.js'
import { createTaskQueue } from './queue.js'
import type { DeriveChange, DeriveEvent, DerivePluginOptions } from '../types.js'
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

export function createDeriveRuntime(userOptions: DerivePluginOptions): Runtime {
  const { root, watch, load, derive, gitignore, gitignoreEntries } = resolveOptions(userOptions)

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
    if (gitignore || gitignoreEntries.length) {
      const relPathsFromFiles = result.files
        .filter((file): file is { path: string; content: string } => 'content' in file)
        .map(file => path.relative(root, file.path).replace(/\\/g, '/'))
        .filter(relPath => relPath && !relPath.startsWith('..'))
      const matched = gitignore ? relPathsFromFiles.filter(relPath => gitignore(relPath)) : []
      await ensureGitignoreEntries(root, [...gitignoreEntries, ...matched])
    }
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
