/* eslint-disable newline-per-chained-call */
import { describe, expect, it } from 'vitest'

import {
  _if,
  assign,
  bitCipher,
  bitDecipher,
  checkValidEmail,
  cn,
  deepCopy,
  deepmerge,
  isObjectEqual,
  lighten,
  sortArrOfObj
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

describe('assign', () => {
  it('assigns a value at a nested path, creating intermediates', () => {
    const object: Record<string, unknown> = {}
    expect(assign(object, ['x'], 7)).toBe(7)
    assign(object, ['a', 'b', 'c'], 42)
    expect(object).toEqual({ a: { b: { c: 42 } }, x: 7 })
  })
})

describe('deepCopy', () => {
  it('clones nested structures without sharing references', () => {
    const source = { a: 1, nested: { list: [1, 2, 3] } }
    const copy = deepCopy(source)

    expect(copy).toEqual(source)
    expect(copy.nested).not.toBe(source.nested)
    copy.nested.list.push(4)
    expect(source.nested.list).toEqual([1, 2, 3])
  })

  it('handles circular references', () => {
    const source: Record<string, unknown> = { name: 'root' }
    source.self = source
    const copy = deepCopy(source)
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
  it('accepts valid and rejects invalid addresses', () => {
    expect(checkValidEmail('user@example.com')).toBe(true)
    expect(checkValidEmail('not-an-email')).toBe(false)
    expect(checkValidEmail('missing@domain')).toBe(false)
  })
})

describe('isObjectEqual', () => {
  it('compares by serialized value', () => {
    expect(isObjectEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(isObjectEqual({ a: 1 }, { a: 2 })).toBe(false)
  })
})

describe('bitCipher / bitDecipher', () => {
  it('round-trips a string', () => {
    const original = 'hello world 123'
    expect(bitDecipher(bitCipher(original))).toBe(original)
  })
})

describe('lighten', () => {
  it('returns transparent for a missing color and lightens towards white', () => {
    expect(lighten(undefined, 50)).toBe('transparent')
    expect(lighten('#000000', 0)).toBe('#000000')
    expect(lighten('#000000', 100)).toBe('#ffffff')
  })
})

describe('cn', () => {
  it('merges conflicting tailwind classes and drops falsy values', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    // eslint-disable-next-line no-constant-binary-expression -- a constant falsy argument is the input under test: this is how conditional classes reach cn() at call sites
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })
})

describe('deepmerge', () => {
  it('merges plain objects', () => {
    expect(deepmerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })
})
