import type { DeriveChange, DeriveChangeType } from '../types.js'

export type QueueState = {
  running: boolean
  pendingFull: boolean
  pendingPatchChanges: Map<string, DeriveChange>
}

export function createQueueState(): QueueState {
  return {
    running: false,
    pendingFull: false,
    pendingPatchChanges: new Map<string, DeriveChange>()
  }
}

export function mergeChangeType(prev: DeriveChangeType, next: DeriveChangeType): DeriveChangeType {
  if (next === 'delete') return 'delete'
  if (prev === 'delete' && next === 'create') return 'update'
  if (next === 'update') return prev === 'create' ? 'create' : 'update'
  if (next === 'create') return prev === 'delete' ? 'update' : 'create'
  return prev === 'unknown' ? next : prev
}
