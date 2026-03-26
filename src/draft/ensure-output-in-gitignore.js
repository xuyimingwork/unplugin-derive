const fs = require('fs')
const path = require('path')

function normalizeEntry(line) {
  return line.trim().replace(/^\//, '').replace(/\\/g, '/')
}

function gitignoreHasEntry(content, relPosix) {
  for (const line of content.split(/\r?\n/)) {
    const n = normalizeEntry(line)
    if (!n || n.startsWith('#')) continue
    if (n === relPosix) return true
  }
  return false
}

/**
 * 若工程根目录 `.gitignore` 中尚未包含 `output` 的相对路径，则追加一行。
 * @param {string} projectRoot
 * @param {string} outputAbsolute
 */
function ensureOutputInGitignore(projectRoot, outputAbsolute) {
  const rel = path.relative(projectRoot, outputAbsolute).replace(/\\/g, '/')
  if (!rel || rel.startsWith('..')) return

  const gitignorePath = path.join(projectRoot, '.gitignore')
  let content = ''
  try {
    content = fs.readFileSync(gitignorePath, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }

  if (gitignoreHasEntry(content, rel)) return

  const prefix = content && !/\n$/.test(content) ? '\n' : ''
  fs.appendFileSync(gitignorePath, `${prefix}${rel}\n`, 'utf8')
}

module.exports = {
  ensureOutputInGitignore
}
