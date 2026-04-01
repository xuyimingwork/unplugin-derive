import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { toRelPath } from './path.js'
import type {
  DeriveLoadOption,
  DeriveLoader,
  DeriveLoaderBase,
  DeriveLoaderBuiltin,
  DeriveLoaderResult,
  ResolvedLoad,
} from '../types.js'

const LEGACY_BUILTIN_LOADER_NAMES = ['text', 'json', 'buffer', 'import'] as const

const BUILTIN_LOADERS: Record<DeriveLoaderBuiltin, DeriveLoaderBase> = {
  _buffer: async absPath => ({ content: await fs.promises.readFile(absPath) }),
  _import: async absPath => ({ content: await import(pathToFileURL(absPath).href) }),
  _text: async absPath => ({ content: await fs.promises.readFile(absPath, 'utf8') }),
  _json: async absPath => ({ content: JSON.parse(await fs.promises.readFile(absPath, 'utf8')) }),
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

function createDeriveLoad(
  loaders?: DeriveLoaderBase[],
  log: (message: string) => void = () => {}
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
      } catch (e: any) {}
    }
    // 所有加载器尝试完毕，无法加载
    log(`load failed for ${path}`)
    return undefined
  }
}

function toDeriveLoaderBases(
  rawLoaders: unknown,
  context: {
    root: string
    log: (message: string) => void
  }
): DeriveLoaderBase[] | undefined {
  return (Array.isArray(rawLoaders) ? rawLoaders : [rawLoaders]).map(loader =>
    toDeriveLoaderBase(loader as DeriveLoader, context)
  )
}

export function createLoadResolver(
  load: DeriveLoadOption | undefined,
  {
    root,
    log,
  }: {
    root: string
    log: (message: string) => void
  }
): ResolvedLoad {
  if (!load) return createDeriveLoad()

  if (typeof load !== 'function') return createDeriveLoad(toDeriveLoaderBases(load, { root, log }), log)
  
  return async path => {
    try {
      const raw = await toDeriveLoaderBase(load as any, { root })(path)
      // 如果是普通加载器
      if (isDeriveLoaderResult(raw)) return raw
      // 如果是路由
      return await createDeriveLoad(toDeriveLoaderBases(raw, { root, log }), log)(path)
    } catch (e: any) {
      log(`load failed for ${path}: ${e?.message || e}`)
      return undefined
    }
  }
}
