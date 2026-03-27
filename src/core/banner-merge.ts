import type { BannerConfig } from '../types.js'

export type ResolvedBanner = false | BannerConfig | undefined

export function mergeBanner(
  ...banners: Array<false | BannerConfig | undefined>
): ResolvedBanner {
  let current: ResolvedBanner = undefined
  for (const banner of banners) {
    if (banner === undefined) continue
    if (banner === false) {
      current = false
      continue
    }
    if (current === undefined || current === false) {
      current = {
        ...banner,
        data: banner.data ? { ...banner.data } : undefined
      }
      continue
    }
    current = {
      ...current,
      ...banner,
      data: {
        ...(current.data || {}),
        ...(banner.data || {})
      }
    }
  }
  return current
}
