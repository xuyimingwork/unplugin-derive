/** Webpack 插件名与生成文件头所用名称 */
const PLUGIN_NAME = 'ApiTypesWebpackPlugin'

const PARSER_PLUGINS = [
  'objectRestSpread',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'optionalChaining',
  'nullishCoalescingOperator',
  'dynamicImport',
  'topLevelAwait'
]

module.exports = {
  PLUGIN_NAME,
  PARSER_PLUGINS
}
