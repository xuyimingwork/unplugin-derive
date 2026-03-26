import path from 'node:path'

export function normalizeRelPath(input: string): string {
  return String(input).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

export function toRelPath(root: string, absPath: string): string {
  const rel = path.relative(root, absPath).replace(/\\/g, '/')
  return normalizeRelPath(rel)
}

export function toAbsPath(root: string, relPath: string): string {
  return path.resolve(root, relPath)
}

export function normalizeIncomingPath(root: string, inputPath: string): string {
  const raw = String(inputPath)
  const relPath = path.isAbsolute(raw) ? toRelPath(root, raw) : normalizeRelPath(raw)
  const absPath = toAbsPath(root, relPath)
  if (!isWithinRoot(root, absPath)) return ''
  return relPath
}

export function isWithinRoot(root: string, absPath: string): boolean {
  const rel = path.relative(root, absPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}
