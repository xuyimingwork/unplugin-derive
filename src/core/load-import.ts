import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'

/* ---------------------------------- */
/* config                             */
/* ---------------------------------- */

const MAX_WORKERS = 8
const TIMEOUT = 30_000

/* ---------------------------------- */
/* types                              */
/* ---------------------------------- */

type WorkerImportRequest = {
  id: number
  fileUrl: string
}

type WorkerImportResponse =
  | { id: number; ok: true; value: Record<string, unknown> }
  | { id: number; ok: false; error: { message: string; stack?: string } }

type PendingJob = {
  resolve: (v: any) => void
  reject: (e: any) => void
  timer: NodeJS.Timeout
}

/* ---------------------------------- */
/* worker code                        */
/* ---------------------------------- */

const INLINE_WORKER_CODE = `
  const { parentPort } = require('node:worker_threads');

  function serializeError(e) {
    if (e instanceof Error) return { message: e.message, stack: e.stack };
    return { message: String(e) };
  }

  function isCloneable(value) {
    try {
      structuredClone(value);
      return true;
    } catch {
      return false;
    }
  }

  function toPlainModuleExports(mod) {
    const plain = {};
    const nonCloneable = [];
    for (const key in mod) {
      const value = mod[key];
      if (isCloneable(value)) {
        plain[key] = value;
      } else {
        nonCloneable.push(key);
      }
    }
    if (nonCloneable.length > 0) {
      throw new Error(\`Non-serializable exports found: \${nonCloneable.join(', ')}\`);
    }
    return plain;
  }

  parentPort.on('message', async (req) => {
    const jobId = req.id;
    const fileUrl = req.fileUrl;

    try {
      const mod = await import(fileUrl);
      parentPort.postMessage({ id: jobId, ok: true, value: toPlainModuleExports(mod) });
    } catch (e) {
      parentPort.postMessage({ id: jobId, ok: false, error: serializeError(e) });
    }
  });
`

/* ---------------------------------- */
/* worker wrapper                     */
/* ---------------------------------- */

let nextJobId = 1

class WorkerWrapper {
  worker: Worker
  busy = false
  jobs = new Map<number, PendingJob>()

  constructor() {
    this.worker = new Worker(INLINE_WORKER_CODE, { 
      eval: true,
      execArgv: ['--no-warnings']
    })

    this.worker.on('message', this.onMessage)
    this.worker.on('error', this.onError)
    this.worker.on('exit', this.onExit)
  }

  run = (jobId: number, req: WorkerImportRequest) => {
    this.busy = true

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.jobs.delete(jobId)
        reject(new Error(`Import timeout: ${req.fileUrl}`))
        this.reset() // 强制回收 worker
      }, TIMEOUT)

      this.jobs.set(jobId, { resolve, reject, timer })
      this.worker.postMessage(req)
    })
  }

  onMessage = (msg: WorkerImportResponse) => {
    const job = this.jobs.get(msg.id)
    if (!job) return

    this.jobs.delete(msg.id)
    clearTimeout(job.timer)

    if (msg.ok) {
      job.resolve(msg.value)
    } else {
      const err = new Error(msg.error?.message || 'worker import failed')
      if (msg.error?.stack) err.stack = msg.error.stack
      job.reject(err)
    }

    this.busy = false
    schedule()
  }

  onError = (err: Error) => {
    this.flushAll(err)
    this.reset()
  }

  onExit = (code: number) => {
    if (code !== 0) {
      this.flushAll(new Error(`worker exited with code ${code}`))
      this.reset()
    }
  }

  flushAll = (err: Error) => {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer)
      job.reject(err)
    }
    this.jobs.clear()
    this.busy = false
  }

  reset = () => {
    this.busy = false
    this.worker.terminate().catch(() => {})
    this.worker = new Worker(INLINE_WORKER_CODE, { 
      eval: true,
      execArgv: ['--no-warnings']
    })

    this.worker.on('message', this.onMessage)
    this.worker.on('error', this.onError)
    this.worker.on('exit', this.onExit)
  }

  terminate = () => {
    return this.worker.terminate().catch(() => {})
  }
}

/* ---------------------------------- */
/* pool & scheduler                   */
/* ---------------------------------- */

const pool: WorkerWrapper[] = []
const queue: Array<{
  jobId: number
  req: WorkerImportRequest
  resolve: (v: any) => void
  reject: (e: any) => void
}> = []

function getWorker(): WorkerWrapper | undefined {
  return pool.find(w => !w.busy)
}

function ensureWorker(): WorkerWrapper | undefined {
  const idle = getWorker()
  if (idle) return idle

  if (pool.length < MAX_WORKERS) {
    const w = new WorkerWrapper()
    pool.push(w)
    return w
  }

  return undefined
}

function schedule() {
  while (queue.length) {
    const worker = ensureWorker()
    if (!worker || worker.busy) return

    const job = queue.shift()!

    worker
      .run(job.jobId, job.req)
      .then(job.resolve, job.reject)
  }
}

/* ---------------------------------- */
/* public API                         */
/* ---------------------------------- */

export function importModuleFresh(absPath: string): Promise<Record<string, unknown>> {
  const jobId = nextJobId++

  const url = new URL(pathToFileURL(absPath).href)
  url.searchParams.set('t', `${Date.now()}-${jobId}`)

  const req: WorkerImportRequest = {
    id: jobId,
    fileUrl: url.href,
  }

  return new Promise((resolve, reject) => {
    queue.push({ jobId, req, resolve, reject })
    schedule()
  })
}

/* ---------------------------------- */
/* shutdown                           */
/* ---------------------------------- */

export async function shutdownImportWorkers() {
  await Promise.all(pool.map(w => w.terminate()))
  pool.length = 0
}