import { createTaskQueue } from './queue.js'
import type { DeriveEvent } from '../types.js'
import type { DeriveTask } from './queue.js'
import type { DeriveContext } from './context.js'

type Runtime = {
  run: (event: DeriveEvent) => Promise<void>
}

export function createDeriveRuntime(context: DeriveContext): Runtime {
  const { log, load, derive, postDerive, emit } = context

  async function executeTask(task: DeriveTask): Promise<void> {
    const startedAt = Date.now()
    let stage = 'load changes'
    try {
      const event = await load(task)
      if (event.type === 'patch' && event.changes.length === 0) {
        log('skip derive task (patch has no changes)')
        return
      }
      log(`start derive task (${task.type}, changes=${event.changes.length})`)
      stage = 'derive'
      const result = await derive(event)
      stage = 'post derive'
      await postDerive(result)
      stage = 'emit files'
      const summary = await emit(result)
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
      await queue.schedule({ type: 'full' })
      return
    }
    await queue.schedule({ type: 'patch', changes: event.changes })
  }

  return { run }
}
