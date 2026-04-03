import createDebug from 'debug'

export type LoggerLevel = 'error' | 'info' | 'debug'

export const logger = {
  plugin: {
    debug: createDebug('unplugin-derive:plugin:debug'),
    info: createDebug('unplugin-derive:plugin:info'),
    error: createDebug('unplugin-derive:plugin:error')
  },
  runtime: {
    debug: createDebug('unplugin-derive:runtime:debug'),
    info: createDebug('unplugin-derive:runtime:info'),
    error: createDebug('unplugin-derive:runtime:error')
  },
  context: {
    debug: createDebug('unplugin-derive:context:debug'),
    info: createDebug('unplugin-derive:context:info'),
    error: createDebug('unplugin-derive:context:error')
  },
  emit: {
    debug: createDebug('unplugin-derive:emit:debug'),
    info: createDebug('unplugin-derive:emit:info'),
    error: createDebug('unplugin-derive:emit:error')
  },
  gitignore: {
    debug: createDebug('unplugin-derive:gitignore:debug'),
    info: createDebug('unplugin-derive:gitignore:info'),
    error: createDebug('unplugin-derive:gitignore:error')
  },
  load: {
    debug: createDebug('unplugin-derive:load:debug'),
    info: createDebug('unplugin-derive:load:info'),
    error: createDebug('unplugin-derive:load:error')
  },
  banner: {
    debug: createDebug('unplugin-derive:banner:debug'),
    info: createDebug('unplugin-derive:banner:info'),
    error: createDebug('unplugin-derive:banner:error')
  }
}

export function setLoggerLevel(level: LoggerLevel | undefined): void {
  if (!level) return

  const enableMap: Record<LoggerLevel, string> = {
    error: 'unplugin-derive:*:error',
    info: 'unplugin-derive:*:info,unplugin-derive:*:error',
    debug: 'unplugin-derive:*'
  }

  const pattern = enableMap[level]
  if (typeof createDebug.enable === 'function') {
    createDebug.enable(pattern)
  } else if (typeof process !== 'undefined' && process.env) {
    process.env.DEBUG = pattern
  }
}
