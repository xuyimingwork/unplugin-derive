import fs from 'node:fs'
import path from 'node:path'

function normalizeEntry(line: string): string {
  return String(line || '')
    .trim()
    .replace(/^\//, '')
    .replace(/\\/g, '/')
}

function hasEntry(content: string, relPosix: string): boolean {
  for (const line of String(content || '').split(/\r?\n/)) {
    const normalized = normalizeEntry(line)
    if (!normalized || normalized.startsWith('#')) continue
    if (normalized === relPosix) return true
  }
  return false
}

export async function ensureGitignoreEntries(
  root: string,
  relPaths: string[]
): Promise<void> {
  const unique = [...new Set(relPaths.map(normalizeEntry).filter(Boolean))]
  if (!unique.length) return
  const gitignorePath = path.join(root, '.gitignore')
  let content = ''
  try {
    content = await fs.promises.readFile(gitignorePath, 'utf8')
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e
  }
  const missing = unique.filter(rel => !hasEntry(content, rel))
  if (!missing.length) return
  const prefix = content && !/\n$/.test(content) ? '\n' : ''
  await fs.promises.appendFile(gitignorePath, `${prefix}${missing.join('\n')}\n`, 'utf8')
}
