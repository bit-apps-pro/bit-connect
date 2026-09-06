import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { relativeTime, select, versionCompare } from './utils'

describe('select', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('finds an element by selector', () => {
    document.body.innerHTML = '<div id="portal">x</div>'

    expect(select('#portal')?.id).toBe('portal')
  })

  it('answers null rather than throwing when nothing matches', () => {
    expect(select('#nothing-here')).toBeNull()
  })
})

// The timestamps come from the REST payload as GMT with no zone marker. Without
// the `Z` a browser reads them as local time, which is how "just now" becomes
// "6h ago" for a reader east of London.
describe('relativeTime', () => {
  const NOW = new Date(2026, 7, 27, 12, 0, 0)

  const MINUTE = 60_000
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR

  const ago = (milliseconds: number) =>
    new Date(NOW.getTime() - milliseconds).toISOString().replace('T', ' ').slice(0, 19)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads the stored timestamp as GMT rather than as local time', () => {
    expect(relativeTime(ago(0))).toBe('just now')
    expect(relativeTime(ago(30_000))).toBe('just now')
  })

  it('counts in the largest unit that fits', () => {
    expect(relativeTime(ago(5 * MINUTE))).toBe('5m ago')
    expect(relativeTime(ago(3 * HOUR))).toBe('3h ago')
    expect(relativeTime(ago(3 * DAY))).toBe('3d ago')
    expect(relativeTime(ago(14 * DAY))).toBe('2w ago')
    expect(relativeTime(ago(90 * DAY))).toBe('3mo ago')
    expect(relativeTime(ago(800 * DAY))).toBe('2y ago')
  })

  it('changes unit exactly at the boundary', () => {
    expect(relativeTime(ago(59_000))).toBe('just now')
    expect(relativeTime(ago(MINUTE))).toBe('1m ago')
    expect(relativeTime(ago(59 * MINUTE))).toBe('59m ago')
    expect(relativeTime(ago(HOUR))).toBe('1h ago')
    expect(relativeTime(ago(23 * HOUR))).toBe('23h ago')
    expect(relativeTime(ago(DAY))).toBe('1d ago')
  })
})

// Used to gate features behind a WordPress or plugin version, so a wrong answer
// either hides something that works or offers something that does not.
describe('versionCompare', () => {
  it('orders two versions without an operator', () => {
    expect(versionCompare('1.2.4', '1.2.3')).toBe(1)
    expect(versionCompare('1.2.3', '1.2.4')).toBe(-1)
    expect(versionCompare('1.2.3', '1.2.3')).toBe(0)
  })

  it('compares each part as a number rather than as text', () => {
    expect(versionCompare('1.10.0', '1.9.0')).toBe(1)
    expect(versionCompare('2.0.0', '10.0.0')).toBe(-1)
  })

  // "1.4" and "1.4.0" are the same release written two ways.
  it('treats a missing part as zero', () => {
    expect(versionCompare('1.4', '1.4.0')).toBe(0)
    expect(versionCompare('1.4.1', '1.4')).toBe(1)
  })

  it('answers each comparison operator', () => {
    expect(versionCompare('1.2.4', '1.2.3', '>')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.3', '>')).toBe(false)
    expect(versionCompare('1.2.3', '1.2.3', '>=')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.4', '<')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.3', '<=')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.3', '===')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.4', '===')).toBe(false)
    expect(versionCompare('1.2.3', '1.2.4', '!==')).toBe(true)
    expect(versionCompare('1.2.3', '1.2.3', '!=')).toBe(false)
  })

  it('answers the equality operators on versions written to different lengths', () => {
    expect(versionCompare('1.4', '1.4.0', '===')).toBe(true)
    expect(versionCompare('1.4', '1.4.0', '!=')).toBe(false)
  })
})
