import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export async function createTempRoot(name: string): Promise<string> {
  return await fs.promises.mkdtemp(path.join(os.tmpdir(), `${name}-`))
}

export async function removeDir(target: string): Promise<void> {
  await fs.promises.rm(target, { recursive: true, force: true })
}

export async function copyDir(source: string, target: string): Promise<void> {
  await fs.promises.mkdir(target, { recursive: true })
  await fs.promises.cp(source, target, { recursive: true })
}

export async function readFileMap(root: string): Promise<Record<string, string>> {
  const entries: Array<[string, string]> = []

  async function visit(dir: string): Promise<void> {
    const items = await fs.promises.readdir(dir, { withFileTypes: true })
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, item.name)
      if (item.isDirectory()) {
        await visit(abs)
        continue
      }
      const rel = path.relative(root, abs).replace(/\\/g, '/')
      const content = await fs.promises.readFile(abs, 'utf8')
      entries.push([rel, content])
    }
  }

  await visit(root)
  return Object.fromEntries(entries)
}
