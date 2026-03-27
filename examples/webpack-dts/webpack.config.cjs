const path = require('node:path')
const Derive = require('unplugin-derive/webpack').webpack
const { createWebpackDtsDerive } = require('./derive/index.cjs')

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    Derive({
      root: __dirname,
      watch: ['src/api/**/*.js'],
      load(filePath) {
        if (filePath.endsWith('/index.js')) return undefined
        if (filePath.endsWith('.js')) return 'import'
        return undefined
      },
      derive: createWebpackDtsDerive({
        outputPath: 'src/api/types.d.ts',
        include: ['src/api/**/*.js'],
        root: __dirname,
        verbose: true
      }),
      verbose: true
    })
  ]
}

