import { describe, expect, it } from 'vitest'

import { versionCompare } from './utils'

describe.concurrent('versionCompare', () => {
  // Tests without operator (should return -1, 0, or 1)
  it('returns -1 when version1 is lower than version2', () => {
    expect(versionCompare('5.8.2', '5.8.3')).toBe(-1)
  })

  it('returns 1 when version1 is greater than version2', () => {
    expect(versionCompare('5.9.0', '5.8.3')).toBe(1)
  })

  it('returns 0 when versions are equal', () => {
    expect(versionCompare('5.8.3', '5.8.3')).toBe(0)
  })

  // Tests with operators
  it('returns true for operator ">" when version1 is greater', () => {
    expect(versionCompare('5.9.0', '5.8.3', '>')).toBe(true)
  })

  it('returns false for operator ">" when version1 is not greater', () => {
    expect(versionCompare('5.8.2', '5.8.3', '>')).toBe(false)
  })

  it('returns true for operator "<" when version1 is lower', () => {
    expect(versionCompare('5.8.2', '5.8.3', '<')).toBe(true)
  })

  it('returns false for operator "<" when version1 is not lower', () => {
    expect(versionCompare('5.9.0', '5.8.3', '<')).toBe(false)
  })

  it('returns true for operator ">=" when version1 is greater or equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '>=')).toBe(true)
    expect(versionCompare('5.9.0', '5.8.3', '>=')).toBe(true)
  })

  it('returns false for operator ">=" when version1 is lower', () => {
    expect(versionCompare('5.8.2', '5.8.3', '>=')).toBe(false)
  })

  it('returns true for operator "<=" when version1 is lower or equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '<=')).toBe(true)
    expect(versionCompare('5.8.2', '5.8.3', '<=')).toBe(true)
  })

  it('returns false for operator "<=" when version1 is greater', () => {
    expect(versionCompare('5.9.0', '5.8.3', '<=')).toBe(false)
  })

  // Tests for equality and inequality operators
  it('returns true for "===" when versions are equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '===')).toBe(true)
  })

  it('returns false for "===" when versions are not equal', () => {
    expect(versionCompare('5.8.2', '5.8.3', '===')).toBe(false)
  })

  it('returns true for "!==" when versions are not equal', () => {
    expect(versionCompare('5.8.2', '5.8.3', '!==')).toBe(true)
  })

  it('returns false for "!==" when versions are equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '!==')).toBe(false)
  })

  it('returns true for "==" when versions are equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '==')).toBe(true)
  })

  it('returns false for "==" when versions are not equal', () => {
    expect(versionCompare('5.8.2', '5.8.3', '==')).toBe(false)
  })

  it('returns true for "!=" when versions are not equal', () => {
    expect(versionCompare('5.8.2', '5.8.3', '!=')).toBe(true)
  })

  it('returns false for "!=" when versions are equal', () => {
    expect(versionCompare('5.8.3', '5.8.3', '!=')).toBe(false)
  })
})
