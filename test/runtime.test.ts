import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveOptions } from '../src/core/options.ts'
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

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      derive: async event => ({
        files: [
          {
            path: 'generated/full.json',
            content: JSON.stringify(event)
          }
        ]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })

    const output = await fs.promises.readFile(path.join(root, 'generated/full.json'), 'utf8')
    expect(JSON.parse(output)).toEqual({
      type: 'full',
      changes: [
        {
          type: 'unknown',
          path: 'src/foo.txt',
          content: 'foo-content',
          loader: '_text'
        }
      ]
    })
  })

  it('should exclude negated watch files when full build collects changes', async () => {
    const root = await createTempRoot('derive-runtime-full-negation')
    tempDirs.push(root)

    const includedFile = path.join(root, 'src/api/user.js')
    const excludedFile = path.join(root, 'src/api/index.js')
    await fs.promises.mkdir(path.dirname(includedFile), { recursive: true })
    await fs.promises.writeFile(includedFile, 'export const user = 1', 'utf8')
    await fs.promises.writeFile(excludedFile, 'export const index = 1', 'utf8')

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: ['src/api/**/*.js', '!src/api/index.js'],
      load: async () => '_text' as const,
      derive: async event => ({
        files: [
          {
            path: 'generated/full-negation.json',
            content: JSON.stringify(event)
          }
        ]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })

    const output = await fs.promises.readFile(path.join(root, 'generated/full-negation.json'), 'utf8')
    const event = JSON.parse(output) as { changes: Array<{ path: string }> }
    const paths = event.changes.map(change => change.path).sort()
    expect(paths).toEqual(['src/api/user.js'])
  })

  it('should drop changes outside root when patch paths are normalized', async () => {
    const root = await createTempRoot('derive-runtime-patch')
    tempDirs.push(root)

    const srcFile = path.join(root, 'src/bar.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'bar-content', 'utf8')

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      derive: async event => ({
        files: [
          {
            path: 'generated/patch.json',
            content: JSON.stringify(event)
          }
        ]
      })
    }))

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
          content: 'bar-content',
          loader: '_text'
        }
      ]
    })
  })

  it('should merge banner from options/result/file and prepend emitted content', async () => {
    const root = await createTempRoot('derive-runtime-banner')
    tempDirs.push(root)
    const srcFile = path.join(root, 'src/value.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'ok', 'utf8')

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      banner: {
        style: 'line-slash',
        data: { author: 'plugin', source: 'src/**/*.txt' }
      },
      derive: async () => ({
        banner: {
          data: { author: 'result' }
        },
        files: [
          {
            path: 'generated/a.txt',
            content: 'A',
            banner: {
              template: 'author=<%= data.author %>, source=<%= data.source %>',
              data: { source: 'file-source' }
            }
          }
        ]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })
    const output = await fs.promises.readFile(path.join(root, 'generated/a.txt'), 'utf8')
    expect(output).toContain('// author=result, source=file-source')
    expect(output).toMatch(/A$/)
  })

  it('should pass relative output path to banner.formatter', async () => {
    const root = await createTempRoot('derive-runtime-banner-formatter-path')
    tempDirs.push(root)
    const srcFile = path.join(root, 'src/value.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'ok', 'utf8')

    let receivedPath: string | undefined
    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      derive: async () => ({
        files: [
          {
            path: 'generated/a.txt',
            content: 'A',
            banner: {
              style: 'line-slash',
              formatter: context => {
                receivedPath = context.path
                return `path=${context.path}`
              }
            }
          }
        ]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })
    expect(receivedPath).toBe('generated/a.txt')

    const output = await fs.promises.readFile(path.join(root, 'generated/a.txt'), 'utf8')
    expect(output).toContain('// path=generated/a.txt')
    expect(output).toMatch(/A$/)
  })

  it('should append generated files to root .gitignore without duplicates', async () => {
    const root = await createTempRoot('derive-runtime-gitignore')
    tempDirs.push(root)
    const srcFile = path.join(root, 'src/value.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'ok', 'utf8')

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      gitignore: true,
      derive: async () => ({
        files: [
          { path: 'generated/a.txt', content: 'A' },
          { path: 'generated/b.txt', content: 'B' }
        ]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })
    await runtime.run({ type: 'full', changes: [] })
    const output = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(output).toBe('generated/a.txt\ngenerated/b.txt\n')
  })

  it('should write static gitignore entries from string array option', async () => {
    const root = await createTempRoot('derive-runtime-gitignore-static')
    tempDirs.push(root)
    const srcFile = path.join(root, 'src/value.txt')
    await fs.promises.mkdir(path.dirname(srcFile), { recursive: true })
    await fs.promises.writeFile(srcFile, 'ok', 'utf8')

    const runtime = createDeriveRuntime(resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: async () => '_text' as const,
      gitignore: ['generated/static.txt', 'cache/tmp.txt'],
      derive: async () => ({
        files: [{ path: 'generated/a.txt', content: 'A' }]
      })
    }))

    await runtime.run({ type: 'full', changes: [] })
    const output = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(output).toBe('generated/static.txt\ncache/tmp.txt\n')
  })
})
