import { describe, expect, it } from 'vitest'
import { mergeBanner } from '../src/core/banner-merge.ts'
import { renderBannerForFile } from '../src/core/banner.ts'

describe('mergeBanner', () => {
  it('should apply later banner over earlier banner', () => {
    const merged = mergeBanner(
      {
        style: 'block-jsdoc',
        data: { author: 'global', source: 'src/**/*.ts' }
      },
      {
        template: 'author=<%= author %>',
        data: { author: 'result' }
      },
      {
        style: 'line-slash',
        data: { source: 'src/api/**/*.ts' }
      }
    )
    expect(merged).toEqual({
      style: 'line-slash',
      template: 'author=<%= author %>',
      data: {
        author: 'result',
        source: 'src/api/**/*.ts'
      }
    })
  })

  it('should treat false as normal override value', () => {
    expect(mergeBanner({ style: 'block-jsdoc' }, false)).toBe(false)
    expect(mergeBanner(false, { style: 'line-hash' })).toEqual({ style: 'line-hash' })
  })
})

describe('renderBannerForFile', () => {
  it('should render built-in template when data.author is provided', () => {
    const rendered = renderBannerForFile(
      {
        data: {
          author: 'tester',
          source: ['src/a.ts', 'src/b.ts'],
          overview: {
            description: 'stats',
            items: ['count=2']
          }
        }
      },
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('@generated')
    expect(rendered).toContain('tester')
    expect(rendered).toContain('src/a.ts; src/b.ts')
    expect(rendered).toContain('@fileoverview')
    expect(rendered).toContain('\n * stats\n * - count=2')
  })

  it('should prefer formatter over template', () => {
    const rendered = renderBannerForFile(
      {
        template: 'TEMPLATE',
        formatter: () => 'FORMATTER',
        style: 'line-slash',
        data: { author: 'tester' }
      },
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('// FORMATTER')
    expect(rendered).not.toContain('TEMPLATE')
  })

  it('should escape block comment terminator for block styles', () => {
    const rendered = renderBannerForFile(
      {
        style: 'block-jsdoc',
        template: 'danger: <%= text %>',
        data: { text: 'x */ y' }
      },
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('danger: x *\\/ y')
    expect(rendered).not.toContain('x */ y')
  })
})
