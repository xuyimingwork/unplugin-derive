import { describe, expect, it, vi } from 'vitest'
import { createTaskQueue, type DeriveTask } from '../src/core/queue.ts'

describe('createTaskQueue', () => {
  it('should merge pending patch tasks when worker is running', async () => {
    const calls: DeriveTask[] = []
    let resumeFirst = () => {}
    const firstDone = new Promise<void>(resolve => {
      resumeFirst = resolve
    })

    const worker = vi.fn(async (task: DeriveTask) => {
      calls.push(task)
      if (calls.length === 1) await firstDone
    })

    const queue = createTaskQueue(worker)
    const first = queue.schedule({
      type: 'patch',
      changes: [{ type: 'create', path: '/a.ts' }]
    })
    const second = queue.schedule({
      type: 'patch',
      changes: [
        { type: 'update', path: '/a.ts' },
        { type: 'create', path: '/b.ts' }
      ]
    })

    resumeFirst()
    await Promise.all([first, second])

    expect(calls).toEqual([
      { type: 'patch', changes: [{ type: 'create', path: '/a.ts', timestamp: undefined }] },
      {
        type: 'patch',
        changes: [
          { type: 'update', path: '/a.ts', timestamp: undefined },
          { type: 'create', path: '/b.ts', timestamp: undefined }
        ]
      }
    ])
  })

  it('should keep later schedule pending until queued task is finished', async () => {
    let resumeFirst = () => {}
    const firstDone = new Promise<void>(resolve => {
      resumeFirst = resolve
    })
    const worker = vi.fn(async () => {
      await firstDone
    })
    const queue = createTaskQueue(worker)

    const first = queue.schedule({
      type: 'patch',
      changes: [{ type: 'create', path: '/a.ts' }]
    })
    const second = queue.schedule({
      type: 'patch',
      changes: [{ type: 'update', path: '/b.ts' }]
    })

    let secondResolved = false
    second.then(() => {
      secondResolved = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(secondResolved).toBe(false)

    resumeFirst()
    await Promise.all([first, second])
  })

  it('should prioritize full task when patch tasks are pending', async () => {
    const calls: DeriveTask[] = []
    let resumeFirst = () => {}
    const firstDone = new Promise<void>(resolve => {
      resumeFirst = resolve
    })

    const worker = vi.fn(async (task: DeriveTask) => {
      calls.push(task)
      if (calls.length === 1) await firstDone
    })

    const queue = createTaskQueue(worker)
    const first = queue.schedule({
      type: 'patch',
      changes: [{ type: 'update', path: '/a.ts' }]
    })
    const second = queue.schedule({
      type: 'patch',
      changes: [{ type: 'update', path: '/b.ts' }]
    })
    const third = queue.schedule({
      type: 'full',
      watches: ['/project/src/**/*.ts']
    })
    const fourth = queue.schedule({
      type: 'patch',
      changes: [{ type: 'update', path: '/c.ts' }]
    })

    resumeFirst()
    await Promise.all([first, second, third, fourth])

    expect(calls).toEqual([
      { type: 'patch', changes: [{ type: 'update', path: '/a.ts' }] },
      { type: 'full', watches: ['/project/src/**/*.ts'] }
    ])
  })
})
