const path = require('path')

/**
 * 跳过 `api` 聚合根目录下的 `index.js`（非子目录内的 index）
 * @param {string} apiRoot 一般为 `src/api` 对应绝对路径
 * @param {string} absPath
 */
function shouldSkipFile(apiRoot, absPath) {
  return path.relative(apiRoot, absPath) === 'index.js'
}

module.exports = {
  shouldSkipFile
}
