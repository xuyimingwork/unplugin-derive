import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import type { BuiltinLoadType } from '../types.js'

export async function applyBuiltinLoader(absPath: string, loader: BuiltinLoadType): Promise<unknown> {
  if (loader === 'buffer') return await fs.promises.readFile(absPath)
  if (loader === 'import') return await import(pathToFileURL(absPath).href)
  const text = await fs.promises.readFile(absPath, 'utf8')
  if (loader === 'text') return text
  return JSON.parse(text)
}
