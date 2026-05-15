import { describe, expect, it } from 'vitest'
import { name as packageName } from '../package.json'
import { getBanner } from '../src/core/banner/banner.ts'

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

  it('should use package name as default author when data.author is omitted', () => {
    const rendered = getBanner(
      [{ style: 'block-jsdoc', data: { source: 'src/**/*.ts' } }],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toContain(packageName)
    // es-toolkit template escapes `*` in interpolated text
    expect(rendered).toContain('src/**\\/*.ts')
  })

  it('should omit built-in author lines when author is explicitly empty', () => {
    const rendered = getBanner(
      [
        {
          style: 'block-jsdoc',
          data: { author: '', source: 'only-source.ts' }
        }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).not.toContain('本文件由')
    expect(rendered).not.toContain('DO NOT EDIT BY HAND')
    expect(rendered).toContain('only-source.ts')
  })

  it('should return empty string when banner stays disabled', () => {
    expect(getBanner([], { path: '/tmp/out.ts', content: 'X' })).toBe('')
    expect(getBanner([undefined], { path: '/tmp/out.ts', content: 'X' })).toBe('')
  })

  it('should enable banner with defaults when banner is true', () => {
    const rendered = getBanner([true], { path: '/tmp/out.ts', content: 'X' })
    expect(rendered).toContain('@generated')
    expect(rendered).toContain(packageName)
  })

  it('should merge data fields without dropping earlier keys', () => {
    const rendered = getBanner(
      [
        { data: { author: 'keep-me', source: 'old.ts' } },
        { data: { source: 'new.ts' } }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toContain('keep-me')
    expect(rendered).toContain('new.ts')
    expect(rendered).not.toContain('old.ts')
  })

  it('should render block-star style with slash-star opener', () => {
    const rendered = getBanner(
      [
        {
          style: 'block-star',
          template: 'note',
          data: { author: 'x' }
        }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered.startsWith('/*\n')).toBe(true)
    expect(rendered).toContain('\n * note\n */')
    expect(rendered.startsWith('/**\n')).toBe(false)
  })

  it('should not escape */ for line-slash style', () => {
    const rendered = getBanner(
      [
        {
          style: 'line-slash',
          template: 'x */ y',
          data: { author: 'a' }
        }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toContain('// x */ y')
  })

  it('should normalize CRLF in banner body before wrapping', () => {
    const rendered = getBanner(
      [
        {
          style: 'line-slash',
          template: 'a\r\nb',
          data: { author: 'a' }
        }
      ],
      { path: '/tmp/out.ts', content: 'X' }
    )
    expect(rendered).toContain('// a')
    expect(rendered).toContain('// b')
    expect(rendered).not.toContain('\r')
  })

  it('should return empty string when formatter output is only whitespace', () => {
    expect(
      getBanner(
        [{ formatter: () => '  \n\t  ', data: { author: 'a' } }],
        { path: '/tmp/out.ts', content: 'X' }
      )
    ).toBe('')
  })

  it('should pass path and content to custom formatter', () => {
    const rendered = getBanner(
      [
        {
          formatter: ({ path, content }) => `path=${path};len=${content.length}`,
          style: 'line-hash',
          data: {}
        }
      ],
      { path: '/abs/file.ts', content: 'abc' }
    )
    expect(rendered).toContain('# path=/abs/file.ts;len=3')
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
