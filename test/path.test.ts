import { describe, expect, it } from 'vitest'
import { isPathWatched } from '../src/core/path.ts'

describe('isPathWatched', () => {
  it('should respect negated patterns for watchChange filtering', () => {
    const watch = ['/root/src/api/**/*.js', '!/root/src/api/index.js']

    expect(isPathWatched('/root/src/api/user.js', watch)).toBe(true)
    expect(isPathWatched('/root/src/api/index.js', watch)).toBe(false)
  })
})
