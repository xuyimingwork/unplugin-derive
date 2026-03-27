import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveOptions } from '../src/core/options.ts'
import { createTempRoot, removeDir } from './utils.ts'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(removeDir))
})

describe('resolveOptions', () => {
  it('should throw when watch is empty', () => {
    expect(() =>
      resolveOptions({
        watch: '',
        derive: async () => ({ files: [] })
      })
    ).toThrowError('`watch` must contain at least one non-empty pattern.')
  })

  it('should normalize watch patterns when resolving options', () => {
    const root = '/tmp/project'
    const { watch } = resolveOptions({
      root,
      watch: ['src/**/*.ts', '!src/**/*.test.ts'],
      derive: async () => ({ files: [] })
    })

    expect(watch).toEqual([
      '/tmp/project/src/**/*.ts',
      '!/tmp/project/src/**/*.test.ts'
    ])
  })

  it('should provide default deriveWhen values', () => {
    const { deriveWhen } = resolveOptions({
      watch: 'src/**/*.ts',
      derive: async () => ({ files: [] })
    })
    expect(deriveWhen).toEqual({ buildStart: 'full', watchChange: 'patch' })
  })

  it('should keep deriveWhen none values when provided', () => {
    const { deriveWhen } = resolveOptions({
      watch: 'src/**/*.ts',
      deriveWhen: { buildStart: 'none', watchChange: 'none' },
      derive: async () => ({ files: [] })
    })
    expect(deriveWhen).toEqual({ buildStart: 'none', watchChange: 'none' })
  })

  it('should map load path to relative path when using built-in loader', async () => {
    const root = await createTempRoot('derive-options')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'hello', 'utf8')

    const userLoad = vi.fn(async (relPath: string) => {
      expect(relPath).toBe('src/input.txt')
      return 'text' as const
    })

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: userLoad,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'hello' })
  })

  it('should normalize derive paths when output files include invalid targets', async () => {
    const root = await createTempRoot('derive-derive')
    tempDirs.push(root)

    const userDerive = vi.fn(async () => ({
      files: [
        { path: 'dist/result.txt', content: 'ok' },
        { path: 'src/watched.ts', content: 'skip watched output' },
        { path: '../outside.txt', content: 'skip outside root' }
      ]
    }))

    const { derive } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      derive: userDerive
    })

    const result = await derive({
      type: 'patch',
      changes: [{ type: 'update', path: path.join(root, 'src/a.ts') }]
    })

    expect(userDerive).toHaveBeenCalledWith({
      type: 'patch',
      changes: [{ type: 'update', path: 'src/a.ts' }]
    })
    expect(result.files).toEqual([
      { path: path.join(root, 'dist/result.txt'), content: 'ok' }
    ])
  })

  it('should treat string array gitignore as static entries', () => {
    const { prepareGitignore } = resolveOptions({
      watch: 'src/**/*.ts',
      gitignore: ['generated/api/types.d.ts', 'dist/output.txt'],
      derive: async () => ({ files: [] })
    })
    expect(typeof prepareGitignore).toBe('function')
  })

  it('should prepare gitignore entries from static and emitted files', async () => {
    const root = await createTempRoot('derive-options-gitignore')
    tempDirs.push(root)
    const { prepareGitignore } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      gitignore: ['generated/static.txt'],
      derive: async () => ({ files: [] })
    })
    await prepareGitignore({
      files: [
        { path: path.join(root, 'generated/dynamic.txt'), content: 'x' }
      ]
    })
    const content = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(content).toBe('generated/static.txt\n')
  })
})
