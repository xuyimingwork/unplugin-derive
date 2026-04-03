import fs from 'node:fs'
import path from 'node:path'

/** File existed and UTF-8 matched derived content — no write. */
export type WriteIfChangedResult = 'written' | 'unchanged'

export async function writeIfChanged(outputPath: string, content: string): Promise<WriteIfChangedResult> {
  let prev = ''
  try {
    prev = await fs.promises.readFile(outputPath, 'utf8')
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e
  }
  if (prev === content) return 'unchanged'
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.promises.writeFile(outputPath, content, 'utf8')
  return 'written'
}

/** `missing` — nothing to unlink. */
export type RemoveIfExistsResult = 'removed' | 'missing'

export async function removeIfExists(targetPath: string): Promise<RemoveIfExistsResult> {
  try {
    await fs.promises.unlink(targetPath)
    return 'removed'
  } catch (e: any) {
    if (e?.code === 'ENOENT') return 'missing'
    throw e
  }
}

