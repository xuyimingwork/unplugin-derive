import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { logger } from './logger.js'
import { toRelPath } from './path.js'
import type {
  DeriveOptionLoad,
  DeriveLoader,
  DeriveLoaderBase,
  DeriveLoaderBuiltin,
  DeriveLoaderResult,
} from '@/types'

export type DeriveOptionLoadResolved = (path: string) => Promise<DeriveLoaderResult>

const LEGACY_BUILTIN_LOADER_NAMES = ['text', 'json', 'buffer', 'import'] as const

const BUILTIN_LOADERS: Record<DeriveLoaderBuiltin, DeriveLoaderBase> = {
  _buffer: async absPath => ({ content: await fs.promises.readFile(absPath), loader: '_buffer' }),
  _import: async absPath => ({ content: await import(pathToFileURL(absPath).href), loader: '_import' }),
  _text: async absPath => ({ content: await fs.promises.readFile(absPath, 'utf8'), loader: '_text' }),
  _json: async absPath => ({ content: JSON.parse(await fs.promises.readFile(absPath, 'utf8')), loader: '_json' }),
}

function normalizeBuiltinLoaderName(name: unknown): DeriveLoaderBuiltin | undefined {
  if (typeof name !== 'string') return undefined
  if (name in BUILTIN_LOADERS) return name as DeriveLoaderBuiltin
  if (LEGACY_BUILTIN_LOADER_NAMES.includes(name as any)) return `_${name}` as DeriveLoaderBuiltin
  return undefined
}

function isObjectWithContent(value: unknown): value is { content: unknown } {
  return !!value && typeof value === 'object' && 'content' in value
}

function isDeriveLoaderResult(value: unknown): value is DeriveLoaderResult {
  return value === undefined || isObjectWithContent(value)
}

function toDeriveLoaderBase(
  loader: DeriveLoader,
  {
    root
  }: {
    root: string
  }
): DeriveLoaderBase {
  const builtin = normalizeBuiltinLoaderName(loader)
  if (builtin) return BUILTIN_LOADERS[builtin]
  if (typeof loader !== 'function') throw new Error('invalid loader: expected built-in loader name or function')
  return path => loader(toRelPath(root, path))
}

function toDeriveLoaderBases(
  rawLoaders: unknown,
  context: {
    root: string
  }
): DeriveLoaderBase[] | undefined {
  return (Array.isArray(rawLoaders) ? rawLoaders : [rawLoaders]).map(loader =>
    toDeriveLoaderBase(loader as DeriveLoader, context)
  )
}

function createDeriveLoad(
  loaders?: DeriveLoaderBase[]
): (path: string) => Promise<DeriveLoaderResult> {
  // 没有指定加载器，不加载文件内容
  if (!loaders || loaders.length === 0) return async () => undefined
  // 按照指定加载器，依次尝试加载
  return async path => {
    for (const loader of loaders) {
      try {
        const result = await loader(path)
        // undefined 表示 loader 无法处理，交由下一个 loader 处理
        if (isObjectWithContent(result)) return result
      } catch (e: any) {
        logger.load.debug(`load try failed for ${path}: ${e?.message || e}`)
      }
    }
    // 所有加载器尝试完毕，未得到 content（非用户错误，与单次 try 失败同属调试信息）
    logger.load.debug(`no loader produced content for ${path}`)
    return undefined
  }
}

export function createLoadResolver(
  load: DeriveOptionLoad | undefined,
  {
    root,
  }: {
    root: string
  }
): DeriveOptionLoadResolved {
  if (!load) return createDeriveLoad()

  if (typeof load !== 'function') return createDeriveLoad(toDeriveLoaderBases(load, { root }))
  
  return async path => {
    let raw
    try {
      raw = await toDeriveLoaderBase(load as any, { root })(path)
      // 如果是普通加载器
      if (isDeriveLoaderResult(raw)) return raw
    } catch (e: any) {
      logger.load.error(`load failed for ${path}: ${e?.message || e}`)
      return undefined
    }
    // 如果是路由
    return await createDeriveLoad(toDeriveLoaderBases(raw, { root }))(path)
  }
}
