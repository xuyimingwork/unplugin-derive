import type { DeriveBanner, DeriveBannerStyle } from '@/types'
import { getBannerFormatter } from './formatter.js'

const DEFAULT_STYLE: DeriveBannerStyle = 'block-jsdoc'

function toCommentBlock(body: string, style: DeriveBannerStyle): string {
  const normalizedBody = String(body).replace(/\r\n?/g, '\n')
  const escapedBody = style === 'block-star' || style === 'block-jsdoc'
    ? normalizedBody.replace(/\*\//g, '*\\/')
    : normalizedBody
  const lines = escapedBody.split('\n')
  if (style === 'line-slash') {
    return lines.map(line => `// ${line}`).join('\n')
  }
  if (style === 'line-hash') {
    return lines.map(line => `# ${line}`).join('\n')
  }
  if (style === 'block-star') {
    const content = lines.map(line => ` * ${line}`).join('\n')
    return `/*\n${content}\n */`
  }
  const content = lines.map(line => ` * ${line}`).join('\n')
  return `/**\n${content}\n */`
}

type BannerConfig = Exclude<DeriveBanner, false> & { disabled?: boolean }
function mergeBannerConfig(banners: (DeriveBanner | undefined)[]): BannerConfig {
  if (!Array.isArray(banners)) return { disabled: true }
  return banners.reduce<BannerConfig>((config, banner) => {
    if (banner === undefined) return config
    if (banner === false) return { ...config, disabled: true }
    return {
      ...config,
      ...banner,
      disabled: false,
      data: {
        ...((config as any).data || {}),
        ...(banner.data || {})
      }
    }
  }, { disabled: true })
}

export function getBanner(
  banners: (DeriveBanner | undefined)[],
  {
    path,
    content
  }: {
    path: string
    content: string
  }
): string {
  const config = mergeBannerConfig(banners)
  if (config.disabled) return ''

  const style = config.style ?? DEFAULT_STYLE
  const formatter = getBannerFormatter({ 
    template: config.template,  
    formatter: config.formatter
  })

  const body = formatter({ 
    path, 
    content, 
    data: config.data || {}, 
    style 
  }).trim()

  if (!body.trim()) return ''
  return `${toCommentBlock(body, style)}\n\n`
}
