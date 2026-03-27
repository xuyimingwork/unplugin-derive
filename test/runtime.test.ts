import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDeriveRuntime } from '../src/core/runtime.ts'
import { createTempRoot, removeDir } from './utils.ts'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeDir))
})

describe('createDeriveRuntime', () => {
  it('should emit derived file when full build runs', async () => {
    const root = await createTempRoot('derive-runtime-full')
    tempDirs.push(root)

    const srcFile = path.join(root, 'src/foo.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'foo-content', 'utf8')

    const runtime = createDeriveRuntime({
      root,
      watch: 'src/**/*.txt',
      load: async () => 'text' as const,
      derive: async event => ({
        files: [
          {
            path: 'generated/full.json',
            content: JSON.stringify(event)
          }
        ]
      })
    })

    await runtime.run({ type: 'full', changes: [] })

    const output = await fs.promises.readFile(path.join(root, 'generated/full.json'), 'utf8')
    expect(JSON.parse(output)).toEqual({
      type: 'full',
      changes: [
        {
          type: 'unknown',
          path: 'src/foo.txt',
          content: 'foo-content'
        }
      ]
    })
  })

  it('should drop changes outside root when patch paths are normalized', async () => {
    const root = await createTempRoot('derive-runtime-patch')
    tempDirs.push(root)

    const srcFile = path.join(root, 'src/bar.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'bar-content', 'utf8')

    const runtime = createDeriveRuntime({
      root,
      watch: 'src/**/*.txt',
      load: async () => 'text' as const,
      derive: async event => ({
        files: [
          {
            path: 'generated/patch.json',
            content: JSON.stringify(event)
          }
        ]
      })
    })

    await runtime.run({
      type: 'patch',
      changes: [
        { type: 'update', path: 'src/bar.txt' },
        { type: 'update', path: '../outside.txt' }
      ]
    })

    const output = await fs.promises.readFile(path.join(root, 'generated/patch.json'), 'utf8')
    expect(JSON.parse(output)).toEqual({
      type: 'patch',
      changes: [
        {
          type: 'update',
          path: 'src/bar.txt',
          content: 'bar-content'
        }
      ]
    })
  })
})
