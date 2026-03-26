const { ApiTypesWebpackPlugin } = require('./ApiTypesWebpackPlugin')
const { collectApiDefinitions } = require('./collect-definitions')
const { renderDts } = require('./render-dts')
const { parseApiFile } = require('./parse-api-file')
const {
  resolvePluginOptions,
  DEFAULT_INCLUDE,
  DEFAULT_OUTPUT
} = require('./resolve-plugin-options')
const {
  formatLocalDateTime,
  formatElapsedMs,
  formatGenerationTimeLine
} = require('./generation-time')
const { ensureOutputInGitignore } = require('./ensure-output-in-gitignore')

module.exports = ApiTypesWebpackPlugin
module.exports.collectApiDefinitions = collectApiDefinitions
module.exports.renderDts = renderDts
module.exports.parseApiFile = parseApiFile
module.exports.resolvePluginOptions = resolvePluginOptions
module.exports.DEFAULT_INCLUDE = DEFAULT_INCLUDE
module.exports.DEFAULT_OUTPUT = DEFAULT_OUTPUT
module.exports.formatLocalDateTime = formatLocalDateTime
module.exports.formatElapsedMs = formatElapsedMs
module.exports.formatGenerationTimeLine = formatGenerationTimeLine
module.exports.ensureOutputInGitignore = ensureOutputInGitignore
module.exports.ApiTypesWebpackPlugin = ApiTypesWebpackPlugin
