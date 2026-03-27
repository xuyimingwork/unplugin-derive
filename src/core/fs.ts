import fs from 'node:fs'
import path from 'node:path'

export async function writeIfChanged(outputPath: string, content: string): Promise<boolean> {
  let prev = ''
  try {
    prev = await fs.promises.readFile(outputPath, 'utf8')
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e
  }
  if (prev === content) return false
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.promises.writeFile(outputPath, content, 'utf8')
  return true
}

export async function removeIfExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(targetPath)
    return true
  } catch (e: any) {
    if (e?.code === 'ENOENT') return false
    throw e
  }
}

