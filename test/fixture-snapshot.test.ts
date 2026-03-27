import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/core/options.ts'
import { createDeriveRuntime } from '../src/core/runtime.ts'
import type { BuiltinLoadType } from '../src/types.ts'
import type { DeriveEvent } from '../src/types.ts'
import { copyDir, createTempRoot, readFileMap, removeDir } from './utils.ts'

const tempDirs: string[] = []
const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeDir))
})

async function withFixture(name: string): Promise<string> {
  const temp = await createTempRoot(`derive-fixture-${name}`)
  tempDirs.push(temp)
  await copyDir(path.join(fixtureRoot, name), temp)
  return temp
}

type MutationStep =
  | { action: 'write'; path: string; content: string }
  | { action: 'delete'; path: string }

type RunStep =
  | { type: 'full' }
  | {
      type: 'patch'
      changes: Array<{
        type: 'create' | 'update' | 'delete' | 'unknown'
        path: string
      }>
    }

type FixtureCase = {
  watch: string | string[]
  loadByExtension?: Record<string, BuiltinLoadType>
  mutateBeforeRun?: MutationStep[]
  run: RunStep[]
  deriveOutputs: Array<{
    path: string
    from: 'event-json' | 'deleted-paths'
  }>
  snapshotDir: string
}

async function readFixtureCase(root: string): Promise<FixtureCase> {
  const raw = await fs.promises.readFile(path.join(root, 'case.json'), 'utf8')
  return JSON.parse(raw) as FixtureCase
}

async function applyMutations(root: string, steps: MutationStep[]): Promise<void> {
  for (const step of steps) {
    const absPath = path.join(root, step.path)
    if (step.action === 'write') {
      await fs.promises.mkdir(path.dirname(absPath), { recursive: true })
      await fs.promises.writeFile(absPath, step.content, 'utf8')
      continue
    }
    await fs.promises.unlink(absPath)
  }
}

function listFixtureNames(): string[] {
  const entries = fs.readdirSync(fixtureRoot, { withFileTypes: true })
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

function resolveFixtureLoader(filePath: string, fixtureCase: FixtureCase): BuiltinLoadType | undefined {
  const map = fixtureCase.loadByExtension
  if (!map) return undefined
  const matchedExt = Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .find(ext => filePath.endsWith(ext))
  if (matchedExt) return map[matchedExt]
  return undefined
}

function renderDerivedContent(
  from: 'event-json' | 'deleted-paths',
  event: DeriveEvent
): string {
  if (from === 'event-json') return JSON.stringify(event, null, 2)
  return event.changes
    .filter(change => change.type === 'delete')
    .map(change => change.path)
    .join('\n')
}

describe('fixtures snapshots', () => {
  it.each(listFixtureNames())('should match snapshot when running fixture %s', async fixtureName => {
    const root = await withFixture(fixtureName)
    const fixtureCase = await readFixtureCase(root)

    await applyMutations(root, fixtureCase.mutateBeforeRun ?? [])

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: fixtureCase.watch,
      load: async filePath => resolveFixtureLoader(filePath, fixtureCase),
      derive: async event => {
        const files = fixtureCase.deriveOutputs.map(output => ({
          path: `${fixtureCase.snapshotDir}/${output.path}`,
          content: renderDerivedContent(output.from, event)
        }))
        return { files }
      }
    }))

    for (const step of fixtureCase.run) {
      if (step.type === 'full') {
        await runtime.run({ type: 'full', changes: [] })
      } else {
        await runtime.run({
          type: 'patch',
          changes: step.changes
        })
      }
    }

    const files = await readFileMap(path.join(root, fixtureCase.snapshotDir))
    expect(files).toMatchSnapshot()
  })
})
