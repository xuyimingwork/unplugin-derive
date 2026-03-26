import path from 'node:path'

export function normalizeSlashes(input: string): string {
  return String(input).replace(/\\/g, '/')
}

export function normalizeRelPath(input: string): string {
  return normalizeSlashes(input).replace(/^\.\//, '').replace(/^\/+/, '')
}

export function toRelPath(root: string, absPath: string): string {
  const rel = normalizeSlashes(path.relative(root, absPath))
  return normalizeRelPath(rel)
}

export function toAbsPath(root: string, relPath: string): string {
  return path.resolve(root, relPath)
}

export function normalizeIncomingAbsPath(root: string, inputPath: string): string {
  const raw = String(inputPath)
  const absPath = path.isAbsolute(raw) ? path.resolve(raw) : toAbsPath(root, normalizeRelPath(raw))
  if (!isWithinRoot(root, absPath)) return ''
  return absPath
}

export function isWithinRoot(root: string, absPath: string): boolean {
  const rel = path.relative(root, absPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}
