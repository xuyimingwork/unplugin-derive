import { createTaskQueue } from './queue'
import { logger } from './logger.js'
import type { DeriveEvent } from '@/types'
import type { DeriveTask } from './queue'
import type { DeriveContext } from './context'

type Runtime = {
  run: (event: DeriveEvent) => Promise<void>
}

export function createDeriveRuntime(context: DeriveContext): Runtime {
  const { load, derive, postDerive, emit } = context

  async function executeTask(task: DeriveTask): Promise<void> {
    const startedAt = Date.now()
    let stage = 'load changes'
    try {
      const event = await load(task)
      logger.runtime.debug(`loaded task event`)
      if (event.type === 'patch' && event.changes.length === 0) {
        logger.runtime.info('skip derive task (patch has no changes)')
        return
      }
      logger.runtime.info(`start derive task (${task.type}, changes=${event.changes.length})`)
      stage = 'derive'
      const result = await derive(event)
      logger.runtime.debug(`derive result files count: ${result.files.length}`)
      stage = 'post derive'
      await postDerive(result)
      stage = 'emit files'
      const summary = await emit(result)
      const elapsed = Date.now() - startedAt
      logger.runtime.info(`done derive task (${task.type}) written=${summary.written}, deleted=${summary.deleted}, skipped=${summary.skipped}, duration=${elapsed}ms`)
    } catch (e: any) {
      const elapsed = Date.now() - startedAt
      logger.runtime.error(`derive task failed at ${stage} (${task.type}, duration=${elapsed}ms): ${e?.message || e}`)
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
