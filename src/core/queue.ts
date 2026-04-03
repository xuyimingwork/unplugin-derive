import type { DeriveChange, DeriveChangeType } from '@/types'

export type DeriveTask =
  | {
      type: 'full'
    }
  | {
      type: 'patch'
      changes: DeriveChange[]
    }

type TaskQueueState = {
  tasks: DeriveTask[]
  activeRun: Promise<void> | undefined
}

export type DeriveTaskWorker = (task: DeriveTask) => Promise<void>
export type DeriveTaskQueue = {
  schedule: (task: DeriveTask) => Promise<void>
}

function createTaskQueueState(): TaskQueueState {
  return {
    tasks: [],
    activeRun: undefined
  }
}

function mergePatchChangeType(prev: DeriveChangeType, next: DeriveChangeType): DeriveChangeType | null {
  if (next === 'delete') return prev === 'create' ? null : 'delete'
  if (prev === 'delete' && next === 'create') return 'update'
  if (next === 'update') return prev === 'create' ? 'create' : 'update'
  if (next === 'create') return prev === 'delete' ? 'update' : 'create'
  return prev === 'unknown' ? next : prev
}

function mergeChangesByPath(prev: DeriveChange[], next: DeriveChange[]): DeriveChange[] {
  const merged = new Map<string, DeriveChange>()
  for (const change of prev) merged.set(change.path, change)
  for (const change of next) {
    const prevChange = merged.get(change.path)
    const mergedType = prevChange ? mergePatchChangeType(prevChange.type, change.type) : change.type
    if (mergedType == null) {
      merged.delete(change.path)
      continue
    }
    merged.set(change.path, {
      ...change,
      type: mergedType
    })
  }
  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path))
}

function enqueueTask(state: TaskQueueState, task: DeriveTask): void {
  if (task.type === 'full') {
    // Full rebuild supersedes all pending patch tasks.
    state.tasks = [task]
    return
  }

  // Patch tasks are redundant if a full rebuild is already queued.
  if (state.tasks.some(v => v.type === 'full')) return
  const lastTask = state.tasks[state.tasks.length - 1]
  if (lastTask?.type === 'patch') {
    lastTask.changes = mergeChangesByPath(lastTask.changes, task.changes)
    return
  }
  state.tasks.push({
    type: 'patch',
    changes: mergeChangesByPath([], task.changes)
  })
}

async function runPendingTasks(state: TaskQueueState, worker: DeriveTaskWorker): Promise<void> {
  if (!state.activeRun) {
    state.activeRun = (async () => {
      try {
        while (state.tasks.length > 0) {
          const nextTask = state.tasks.shift()
          if (!nextTask) continue
          await worker(nextTask)
        }
      } finally {
        state.activeRun = undefined
      }
    })()
  }
  await state.activeRun
}

export function createTaskQueue(worker: DeriveTaskWorker): DeriveTaskQueue {
  const state = createTaskQueueState()
  return {
    async schedule(task) {
      enqueueTask(state, task)
      await runPendingTasks(state, worker)
    }
  }
}
