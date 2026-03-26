import type { DeriveChange, DeriveChangeType } from '../types.js'

export type DeriveTask =
  | {
      type: 'full'
    }
  | {
      type: 'patch'
      changes: DeriveChange[]
    }

export type QueueState = {
  running: boolean
  tasks: DeriveTask[]
}

export type DeriveTaskWorker = (task: DeriveTask) => Promise<void>

export function createQueueState(): QueueState {
  return {
    running: false,
    tasks: []
  }
}

function mergeChangeType(prev: DeriveChangeType, next: DeriveChangeType): DeriveChangeType {
  if (next === 'delete') return 'delete'
  if (prev === 'delete' && next === 'create') return 'update'
  if (next === 'update') return prev === 'create' ? 'create' : 'update'
  if (next === 'create') return prev === 'delete' ? 'update' : 'create'
  return prev === 'unknown' ? next : prev
}

function mergePatchChanges(prev: DeriveChange[], next: DeriveChange[]): DeriveChange[] {
  const merged = new Map<string, DeriveChange>()
  for (const change of prev) merged.set(change.path, change)
  for (const change of next) {
    const prevChange = merged.get(change.path)
    const mergedType = prevChange ? mergeChangeType(prevChange.type, change.type) : change.type
    merged.set(change.path, {
      ...change,
      type: mergedType,
      timestamp: change.timestamp ?? prevChange?.timestamp
    })
  }
  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path))
}

function enqueueTask(queueState: QueueState, task: DeriveTask): void {
  if (task.type === 'full') {
    queueState.tasks = [{ type: 'full' }]
    return
  }

  // Patches are redundant if a full rebuild is already queued.
  if (queueState.tasks.some(v => v.type === 'full')) return
  const lastTask = queueState.tasks[queueState.tasks.length - 1]
  if (lastTask?.type === 'patch') {
    lastTask.changes = mergePatchChanges(lastTask.changes, task.changes)
    return
  }
  queueState.tasks.push({
    type: 'patch',
    changes: mergePatchChanges([], task.changes)
  })
}

export async function scheduleTask(
  queueState: QueueState,
  task: DeriveTask,
  worker: DeriveTaskWorker
): Promise<void> {
  enqueueTask(queueState, task)
  if (queueState.running) return
  queueState.running = true
  try {
    while (queueState.tasks.length > 0) {
      const nextTask = queueState.tasks.shift()
      if (!nextTask) continue
      await worker(nextTask)
    }
  } finally {
    queueState.running = false
  }
}
