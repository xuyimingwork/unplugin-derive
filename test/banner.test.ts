import { describe, expect, it } from 'vitest'
import { getBanner } from '../src/core/banner.ts'

describe('getBanner', () => {
  it('should merge later banner over earlier banner', () => {
    const rendered = getBanner(
      [
        {
          style: 'block-jsdoc',
          data: { author: 'global', source: 'src/**/*.ts' }
        },
        {
          template: 'author=<%= data.author %>',
          data: { author: 'result' }
        },
        {
          style: 'line-slash',
          data: { source: 'src/api/**/*.ts' }
        }
      ],
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('// author=result')
    expect(rendered).not.toContain('global')
  })

  it('should treat false as normal override value', () => {
    const disabled = getBanner(
      [{ style: 'block-jsdoc', data: { author: 'a' } }, false],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(disabled).toBe('')

    const reenabled = getBanner(
      [false, { style: 'line-hash', data: { author: 'b' } }],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(reenabled).toContain('# @generated')
  })

  it('should render built-in template when data.author is provided', () => {
    const rendered = getBanner(
      [
        {
          data: {
            author: 'tester',
            source: ['src/a.ts', 'src/b.ts'],
            overview: {
              description: 'stats',
              items: ['count=2']
            }
          }
        }
      ],
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
    const rendered = getBanner(
      [
        {
          template: 'TEMPLATE',
          formatter: () => 'FORMATTER',
          style: 'line-slash',
          data: { author: 'tester' }
        }
      ],
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('// FORMATTER')
    expect(rendered).not.toContain('TEMPLATE')
  })

  it('should escape block comment terminator for block styles', () => {
    const rendered = getBanner(
      [
        {
          style: 'block-jsdoc',
          template: 'danger: <%= data.text %>',
          data: { text: 'x */ y' }
        }
      ],
      {
        path: '/tmp/out.ts',
        content: 'export const x = 1\n'
      }
    )
    expect(rendered).toContain('danger: x *\\/ y')
    expect(rendered).not.toContain('x */ y')
  })

  it('should render empty when no data.author is provided', () => {
    const rendered = getBanner(
      [{ style: 'block-jsdoc', data: { source: 'src/**/*.ts' } }],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toBe('')
  })

  it('should not expose path in template scope by default', () => {
    const rendered = getBanner(
      [
        {
          style: 'line-slash',
          template: 'path=<%= data.path %>; author=<%= data.author %>',
          data: { author: 'tester' }
        }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toContain('// path=')
    expect(rendered).toContain('author=tester')
    expect(rendered).not.toContain('/tmp/out.ts')
  })
})
