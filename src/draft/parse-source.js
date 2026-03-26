const parser = require('@babel/parser')
const { PARSER_PLUGINS } = require('./constants')

function parseSource(code, filename) {
  return parser.parse(code, {
    sourceType: 'module',
    errorRecovery: false,
    sourceFilename: filename,
    plugins: PARSER_PLUGINS
  })
}

module.exports = {
  parseSource
}
