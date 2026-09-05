/* eslint-disable newline-per-chained-call */
import { describe, expect, it } from 'vitest'

import {
  _if,
  assign,
  bitCipher,
  bitDecipher,
  checkValidEmail,
  cn,
  combineMerge,
  dateTimeFormatter,
  deepCopy,
  deepmerge,
  isObjectEqual,
  lighten,
  sortArrOfObj,
  timeAgo
} from './globalHelpers'

describe('_if should return the correct value', () => {
  it('should return the correct value', () => {
    expect(_if(true).then(true).else(false).end()).toBe(true)
    expect(_if(false).then(true).else(false).end()).toBe(false)
    // eslint-disable-next-line unicorn/no-null
    expect(_if(null).then(true).else(false).end()).toBe(false)
    // eslint-disable-next-line unicorn/no-useless-undefined
    expect(_if(undefined).then(true).else(false).end()).toBe(false)
    expect(_if(0).then(true).else(false).end()).toBe(false)
    expect(_if('').then(true).else(false).end()).toBe(false)
  })

  it('should return the correct value with elseIf', () => {
    expect(_if(true).then(true).elseIf(false).then(false).else(true).end()).toBe(true)
    expect(_if(false).then(true).elseIf(false).then(false).else(true).end()).toBe(true)
    expect(_if(true).then(true).elseIf(true).then(false).else(true).end()).toBe(true)
    expect(_if(false).then(true).elseIf(true).then(false).else(true).end()).toBe(false)
  })
})

// Build a date `secondsAgo` seconds before now. Uses generous offsets so the
// few ms that elapse during the test never push a value across a boundary.
const ago = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString()

describe('timeAgo', () => {
  it('returns "just now" for < 60 seconds', () => {
    expect(timeAgo(ago(5))).toBe('just now')
  })

  it('formats minutes with singular/plural', () => {
    expect(timeAgo(ago(90))).toBe('1 min ago')
    expect(timeAgo(ago(5 * 60))).toBe('5 mins ago')
  })

  it('formats hours with singular/plural', () => {
    expect(timeAgo(ago(60 * 60 + 30))).toBe('1 hour ago')
    expect(timeAgo(ago(3 * 60 * 60))).toBe('3 hours ago')
  })

  it('formats days with singular/plural', () => {
    expect(timeAgo(ago(24 * 60 * 60 + 60))).toBe('1 day ago')
    expect(timeAgo(ago(5 * 24 * 60 * 60))).toBe('5 days ago')
  })

  it('formats months with singular/plural', () => {
    expect(timeAgo(ago(35 * 24 * 60 * 60))).toBe('1 month ago')
    expect(timeAgo(ago(90 * 24 * 60 * 60))).toBe('3 months ago')
  })

  it('formats years', () => {
    expect(timeAgo(ago(400 * 24 * 60 * 60))).toBe('1 year ago')
    expect(timeAgo(ago(800 * 24 * 60 * 60))).toBe('2 years ago')
  })

  it('returns the original string for an invalid date', () => {
    expect(timeAgo('not-a-date')).toBe('not-a-date')
  })
})

describe('assign', () => {
  it('assigns a value at a single-key path and returns it', () => {
    const object: Record<string, unknown> = {}
    expect(assign(object, ['x'], 7)).toBe(7)
    expect(object).toEqual({ x: 7 })
  })

  it('creates intermediate objects for a nested path', () => {
    const object: Record<string, unknown> = {}
    assign(object, ['a', 'b', 'c'], 42)
    expect(object).toEqual({ a: { b: { c: 42 } } })
  })
})

describe('deepCopy', () => {
  it('clones nested structures without sharing references', () => {
    const source = { a: 1, nested: { list: [1, 2, 3] } }
    const copy = deepCopy(source)

    expect(copy).toEqual(source)
    expect(copy).not.toBe(source)
    expect(copy.nested).not.toBe(source.nested)

    copy.nested.list.push(4)
    expect(source.nested.list).toEqual([1, 2, 3])
  })

  it('returns primitives unchanged', () => {
    expect(deepCopy(5)).toBe(5)
    // eslint-disable-next-line unicorn/no-null
    expect(deepCopy(null)).toBe(null)
  })

  it('handles circular references', () => {
    const source: Record<string, unknown> = { name: 'root' }
    source.self = source
    const copy = deepCopy(source)
    expect(copy.name).toBe('root')
    expect(copy.self).toBe(copy)
  })
})

describe('sortArrOfObj', () => {
  it('sorts case-insensitively by the given label', () => {
    const data = [{ name: 'Banana' }, { name: 'apple' }, { name: 'cherry' }]
    expect(sortArrOfObj(data, 'name')).toEqual([
      { name: 'apple' },
      { name: 'Banana' },
      { name: 'cherry' }
    ])
  })
})

describe('checkValidEmail', () => {
  it('accepts valid addresses', () => {
    expect(checkValidEmail('user@example.com')).toBe(true)
    expect(checkValidEmail('first.last@sub.example.co')).toBe(true)
  })

  it('rejects invalid addresses', () => {
    expect(checkValidEmail('not-an-email')).toBe(false)
    expect(checkValidEmail('missing@domain')).toBe(false)
    expect(checkValidEmail('@example.com')).toBe(false)
  })
})

describe('isObjectEqual', () => {
  it('compares by serialized value', () => {
    expect(isObjectEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(isObjectEqual({ a: 1 }, { a: 2 })).toBe(false)
  })

  it('is order-sensitive (JSON.stringify based)', () => {
    // eslint-disable-next-line perfectionist/sort-objects -- the differing key order IS the assertion; sorting these would make the two objects identical and invert the expected result
    expect(isObjectEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(false)
  })
})

describe('bitCipher / bitDecipher', () => {
  it('round-trips a string', () => {
    const original = 'hello world 123'
    expect(bitDecipher(bitCipher(original))).toBe(original)
  })

  it('does not store the plaintext', () => {
    expect(bitCipher('secret')).not.toContain('secret')
  })
})

describe('lighten', () => {
  it('returns transparent for a missing color', () => {
    expect(lighten(undefined, 50)).toBe('transparent')
  })

  it('lightens black towards white by percentage', () => {
    expect(lighten('#000000', 0)).toBe('#000000')
    expect(lighten('#000000', 100)).toBe('#ffffff')
  })
})

describe('cn', () => {
  it('merges conflicting tailwind classes, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('drops falsy values', () => {
    // eslint-disable-next-line no-constant-binary-expression -- a constant falsy argument is the input under test: this is how conditional classes reach cn() at call sites
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })
})

describe('deepmerge / combineMerge', () => {
  it('merges plain objects', () => {
    expect(deepmerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  it('combineMerge merges arrays index-wise', () => {
    const result = combineMerge([{ a: 1 }], [{ b: 2 }], {
      cloneUnlessOtherwiseSpecified: (value: object) => value,
      isMergeableObject: (value: object) => typeof value === 'object' && value !== null
    })
    expect(result).toEqual([{ a: 1, b: 2 }])
  })
})

describe('dateTimeFormatter', () => {
  it('returns "Invalid Date" for an unparseable string', () => {
    expect(dateTimeFormatter('nope', 'Y')).toBe('Invalid Date')
  })

  it('formats the year token', () => {
    expect(dateTimeFormatter('2023-06-15T12:00:00Z', 'Y')).toBe('2023')
  })
})
