const fs = require('fs')
const path = require('path')

function writeIfChanged(outputPath, content) {
  let prev = ''
  try {
    prev = fs.readFileSync(outputPath, 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  if (prev === content) return false
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf8')
  return true
}

module.exports = {
  writeIfChanged
}
