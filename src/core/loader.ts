import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { toAbsPath } from './path.js'
import type { BuiltinLoadType, DeriveChange, LoadResolver, LoadResult } from '../types.js'

export async function applyBuiltinLoader(absPath: string, loader: BuiltinLoadType): Promise<unknown> {
  if (loader === 'buffer') return await fs.promises.readFile(absPath)
  if (loader === 'import') return await import(pathToFileURL(absPath).href)
  const text = await fs.promises.readFile(absPath, 'utf8')
  if (loader === 'text') return text
  return JSON.parse(text)
}

export async function loadChangeContent(
  root: string,
  change: DeriveChange,
  load: LoadResolver | undefined,
  log: (message: string) => void
): Promise<DeriveChange> {
  if (!load) return change
  let result: LoadResult
  try {
    result = await load(change.path)
  } catch (e: any) {
    log(`load failed for ${change.path}: ${e?.message || e}`)
    return change
  }
  if (result == null) return change
  if (typeof result === 'string') {
    try {
      const content = await applyBuiltinLoader(toAbsPath(root, change.path), result)
      return { ...change, content }
    } catch (e: any) {
      if (e?.code !== 'ENOENT') log(`built-in load(${result}) failed for ${change.path}: ${e?.message || e}`)
      return change
    }
  }
  return { ...change, content: result.content }
}
