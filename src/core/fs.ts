import fs from 'node:fs'
import path from 'node:path'

export function writeIfChanged(outputPath: string, content: string): boolean {
  let prev = ''
  try {
    prev = fs.readFileSync(outputPath, 'utf8')
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e
  }
  if (prev === content) return false
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf8')
  return true
}

export function removeIfExists(targetPath: string): boolean {
  try {
    fs.unlinkSync(targetPath)
    return true
  } catch (e: any) {
    if (e?.code === 'ENOENT') return false
    throw e
  }
}

