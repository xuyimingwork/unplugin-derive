import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { createDeriveContext } from '../src/core/context.ts'
import { resolveOptions } from '../src/core/options.ts'
import { createDeriveRuntime } from '../src/core/runtime.ts'
import { createTempRoot, removeDir } from './utils.ts'

describe('worker-based _import loader', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(removeDir))
  })

  it('should see updated module content without process restart', async () => {
    const root = await createTempRoot('load-import-freshness')
    tempDirs.push(root)

    const modulePath = path.join(root, 'src/api/foo.js')
    await fs.promises.mkdir(path.dirname(modulePath), { recursive: true })

    async function writeLen(len: number): Promise<void> {
      const content = `export default Array.from({length:${len}}, (_, i) => ({ id: i }))`
      await fs.promises.writeFile(modulePath, content, 'utf8')
    }

    const runtime = createDeriveRuntime(createDeriveContext(resolveOptions({
      root,
      watch: 'src/**/*.js',
      load: ['_import', '_text'],
      derive: async event => {
        const foo = event.type === 'full'
          ? event.changes.find(c => c.path === 'src/api/foo.js')
          : event.changes.find(c => c.path === 'src/api/foo.js')
        const mod = foo?.content as any
        const len = Array.isArray(mod?.default) ? mod.default.length : -1
        return {
          files: [
            { path: 'generated/out.json', content: JSON.stringify({ len }) }
          ]
        }
      }
    })))

    await writeLen(1)
    await runtime.run({ type: 'full', changes: [] })
    const out1 = JSON.parse(await fs.promises.readFile(path.join(root, 'generated/out.json'), 'utf8'))
    expect(out1.len).toBe(1)

    await writeLen(2)
    await runtime.run({ type: 'full', changes: [] })
    const out2 = JSON.parse(await fs.promises.readFile(path.join(root, 'generated/out.json'), 'utf8'))
    expect(out2.len).toBe(2)
  })

  it('should fall back to _text when _import throws', async () => {
    const root = await createTempRoot('load-import-fallback')
    tempDirs.push(root)

    const badPath = path.join(root, 'src/api/bad.js')
    await fs.promises.mkdir(path.dirname(badPath), { recursive: true })
    // Syntax error so ESM import will throw.
    await fs.promises.writeFile(badPath, 'export default [;', 'utf8')

    const runtime = createDeriveRuntime(createDeriveContext(resolveOptions({
      root,
      watch: 'src/**/*.js',
      load: ['_import', '_text'],
      derive: async event => {
        const bad = event.changes.find(c => c.path === 'src/api/bad.js')!
        return {
          files: [
            { path: 'generated/out.json', content: JSON.stringify({ loader: bad.loader, type: typeof bad.content }) }
          ]
        }
      }
    })))

    await runtime.run({ type: 'full', changes: [] })
    const out = JSON.parse(await fs.promises.readFile(path.join(root, 'generated/out.json'), 'utf8'))
    expect(out.loader).toBe('_text')
    expect(out.type).toBe('string')
  })
})

