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

  it('should throw when watch patterns are blank', () => {
    expect(() =>
      resolveOptions({
        watch: '   ',
        derive: async () => ({ files: [] })
      })
    ).toThrowError('`watch` must contain at least one non-empty pattern.')

    expect(() =>
      resolveOptions({
        watch: ['  ', '\n\t'],
        derive: async () => ({ files: [] })
      })
    ).toThrowError('`watch` must contain at least one non-empty pattern.')
  })

  it('should ignore non-string watch entries at runtime (defensive)', () => {
    const root = '/tmp/project'
    const { watch } = resolveOptions({
      root,
      watch: ['src/**/*.ts', null, undefined, ''] as any,
      derive: async () => ({ files: [] })
    })

    expect(watch).toEqual(['/tmp/project/src/**/*.ts'])
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

  it('should keep negated watch paths writable in emit output filtering', async () => {
    const root = await createTempRoot('derive-watch-negation')
    tempDirs.push(root)

    const { derive } = resolveOptions({
      root,
      watch: ['src/api/**/*.js', '!src/api/index.js'],
      derive: async () => ({
        files: [
          { path: 'src/api/user.js', content: 'skip me' },
          { path: 'src/api/index.js', content: 'keep me' }
        ]
      })
    })

    const result = await derive({
      type: 'patch',
      changes: [{ type: 'update', path: path.join(root, 'src/api/user.js') }]
    })

    expect(result.files).toEqual([
      { path: path.join(root, 'src/api/user.js'), content: 'skip me' },
      { path: path.join(root, 'src/api/index.js'), content: 'keep me' }
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
      return '_text' as const
    })

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: userLoad as any,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'hello', loader: '_text' })
  })

  it('should try load methods in order when load returns array', async () => {
    const root = await createTempRoot('derive-options-load-array')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'fallback-content', 'utf8')

    const userLoad = vi.fn(async () => ['_json', '_text'] as const)

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: userLoad as any,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'fallback-content', loader: '_text' })
  })

  it('should support load factory in array form', async () => {
    const root = await createTempRoot('derive-options-load-factory')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.ts')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'export const x = 1', 'utf8')

    const userLoad = vi.fn(async () => [() => ({ content: { fromFactory: true } })])

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      load: userLoad,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: { fromFactory: true } })
  })

  it('should continue to next load method when previous factory throws', async () => {
    const root = await createTempRoot('derive-options-load-array-fallback-on-error')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'fallback-content', 'utf8')

    const userLoad = vi.fn(async () => [
      () => {
        throw new Error('factory failed')
      },
      '_text' as const
    ])

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: userLoad,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'fallback-content', loader: '_text' })
  })

  it('should treat top-level load factory return value as single custom loader', async () => {
    const root = await createTempRoot('derive-options-load-factory-unsupported')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.ts')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'export const x = 1', 'utf8')

    const userLoad = vi.fn(async () => (() => ({ content: { fromFactory: true } })) as any)

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      load: userLoad,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: { fromFactory: true } })
  })

  it('should throw when load result object has no content field', async () => {
    const root = await createTempRoot('derive-options-load-invalid-object')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.ts')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'export const x = 1', 'utf8')

    const userLoad = vi.fn(async () => ({ foo: 'bar' } as any))

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      load: userLoad,
      derive: async () => ({ files: [] })
    })

    await expect(load(sourceFile)).rejects.toThrowError('invalid loader: expected built-in loader name or function')
  })

  it('should support fixed built-in load shorthand', async () => {
    const root = await createTempRoot('derive-options-load-fixed-single')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'hello-fixed', 'utf8')

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: '_text',
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'hello-fixed', loader: '_text' })
  })

  it('should support fixed load chain shorthand', async () => {
    const root = await createTempRoot('derive-options-load-fixed-chain')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'hello-chain', 'utf8')

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: ['_json', '_text'],
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'hello-chain', loader: '_text' })
  })

  it('should support legacy built-in names at runtime', async () => {
    const root = await createTempRoot('derive-options-load-legacy-builtin')
    tempDirs.push(root)

    const sourceFile = path.join(root, 'src/input.txt')
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true })
    await fs.promises.writeFile(sourceFile, 'legacy-ok', 'utf8')

    const { load } = resolveOptions({
      root,
      watch: 'src/**/*.txt',
      load: ['json', 'text'] as any,
      derive: async () => ({ files: [] })
    })

    const result = await load(sourceFile)
    expect(result).toEqual({ content: 'legacy-ok', loader: '_text' })
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
      { path: path.join(root, 'dist/result.txt'), content: 'ok' },
      { path: path.join(root, 'src/watched.ts'), content: 'skip watched output' },
      { path: path.join(root, '../outside.txt'), content: 'skip outside root' }
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

  it('should ignore empty gitignore entries', async () => {
    const root = await createTempRoot('derive-options-gitignore-empty')
    tempDirs.push(root)
    const { prepareGitignore } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      gitignore: ['generated/ok.txt', '', '  '],
      derive: async () => ({ files: [] })
    })
    await prepareGitignore({ files: [] })
    const content = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(content).toBe('generated/ok.txt\n')
  })

  it('should ignore non-string gitignore entries at runtime (defensive)', async () => {
    const root = await createTempRoot('derive-options-gitignore-non-string')
    tempDirs.push(root)
    const { prepareGitignore } = resolveOptions({
      root,
      watch: 'src/**/*.ts',
      gitignore: ['generated/ok.txt', null, undefined] as any,
      derive: async () => ({ files: [] })
    })
    await prepareGitignore({ files: [] })
    const content = await fs.promises.readFile(path.join(root, '.gitignore'), 'utf8')
    expect(content).toBe('generated/ok.txt\n')
  })
})
