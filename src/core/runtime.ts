import { createTaskQueue } from './queue'
import { logger } from './logger.js'
import type { DeriveEvent } from '@/types'
import type { DeriveTask } from './queue'
import type { DeriveContext } from './context'
import type { EmitSummary } from './emitter'

type Runtime = {
  run: (event: DeriveEvent) => Promise<void>
}

function formatEmitSkippedBreakdown(summary: EmitSummary): string {
  if (summary.skipped === 0) return ''
  const parts: string[] = []
  if (summary.skippedContentIdentical > 0) {
    parts.push(`same-on-disk=${summary.skippedContentIdentical}`)
  }
  if (summary.skippedDeleteAbsent > 0) {
    parts.push(`delete-missing=${summary.skippedDeleteAbsent}`)
  }
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function formatNoopExamples(summary: EmitSummary): string {
  if (summary.noopSamples.length === 0) return ''
  const bits = summary.noopSamples.map(s =>
    s.kind === 'content_identical'
      ? `${s.relPath} (content already matches disk)`
      : `${s.relPath} (delete: file not on disk)`)
  const tail = summary.noopSamplesOmitted > 0 ? `; +${summary.noopSamplesOmitted} more` : ''
  return `${bits.join('; ')}${tail}`
}

function logNoDiskWrite(
  taskType: DeriveTask['type'],
  deriveOutputCount: number,
  summary: EmitSummary
): void {
  if (summary.written > 0 || summary.deleted > 0) return

  if (deriveOutputCount === 0) {
    logger.runtime.info(
      `emit: no disk write (${taskType}) — derive produced 0 output files`
    )
    return
  }
  if (summary.emittable === 0) {
    logger.runtime.info(
      `emit: no disk write (${taskType}) — ${summary.outputTotal} derive output(s) not emitted (${summary.filteredOut} filtered: outside root or output path matches watch)`
    )
    return
  }
  const expl: string[] = []
  if (summary.skippedContentIdentical > 0) {
    expl.push(
      `${summary.skippedContentIdentical} write(s) skipped: derived UTF-8 equals existing file`
    )
  }
  if (summary.skippedDeleteAbsent > 0) {
    expl.push(`${summary.skippedDeleteAbsent} delete(s) skipped: path did not exist`)
  }
  const examples = formatNoopExamples(summary)
  if (expl.length === 0) {
    logger.runtime.info(
      `emit: no disk write (${taskType}) — ${summary.skipped} emit no-op(s) (no breakdown)${examples ? ` — e.g. ${examples}` : ''}`
    )
    return
  }
  logger.runtime.info(
    `emit: no disk write (${taskType}) — ${expl.join('; ')}${examples ? ` — e.g. ${examples}` : ''}`
  )
}

export function createDeriveRuntime(context: DeriveContext): Runtime {
  const { load, derive, postDerive, emit } = context
  let deriveTaskSeq = 0

  async function executeTask(task: DeriveTask): Promise<void> {
    const taskId = ++deriveTaskSeq
    const taskLabel =
      task.type === 'patch' ? `patch, ${task.changes.length} queued path(s)` : 'full rebuild'
    logger.runtime.info(`── derive task #${taskId} begin (${taskLabel}) ──`)

    const startedAt = Date.now()
    let stage = 'load_changes'
    let status: 'ok' | 'skipped' | 'failed' = 'ok'
    try {
      const event = await load(task)
      logger.runtime.debug('loaded task event')
      if (event.type === 'patch' && event.changes.length === 0) {
        if (task.type === 'patch' && task.changes.length > 0) {
          logger.runtime.info(
            'no disk write (patch) — watch path never entered derive (outside root or not matched by watch)'
          )
        } else {
          logger.runtime.info('skip task: patch has no changes after load')
        }
        status = 'skipped'
        return
      }
      stage = 'derive'
      logger.runtime.info(`derive: start (${task.type}, ${event.changes.length} input change(s))`)
      const result = await derive(event)
      const deriveOutCount = result.files.length
      logger.runtime.info(`derive: done (${deriveOutCount} output file(s))`)
      logger.runtime.debug(`derive result files count: ${deriveOutCount}`)
      stage = 'gitignore'
      await postDerive(result)
      stage = 'emit'
      const summary = await emit(result)
      const elapsed = Date.now() - startedAt
      logger.runtime.info(
        `emit: done (${task.type}) written=${summary.written}, deleted=${summary.deleted}, skipped=${summary.skipped}${formatEmitSkippedBreakdown(summary)}, ${elapsed}ms`
      )
      logNoDiskWrite(task.type, deriveOutCount, summary)
    } catch (e: any) {
      status = 'failed'
      const elapsed = Date.now() - startedAt
      logger.runtime.error(
        `derive task #${taskId} failed at ${stage} (${task.type}, ${elapsed}ms): ${e?.message || e}`
      )
      throw e
    } finally {
      const ms = Date.now() - startedAt
      const endLabel = status === 'failed' ? 'failed' : status
      logger.runtime.info(`── derive task #${taskId} end ${endLabel} (${ms}ms) ──`)
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
