import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearRecentSearches,
  forgetSearch,
  MAX_RECENT_SEARCHES,
  readRecentSearches,
  rememberSearch
} from './recent-searches'

describe('recent searches', () => {
  beforeEach(() => localStorage.clear())

  it('keeps the newest first, once each, ignoring case', () => {
    rememberSearch('api')
    rememberSearch('billing')
    rememberSearch('API')

    expect(readRecentSearches()).toEqual(['API', 'billing'])
  })

  it(`keeps at most ${MAX_RECENT_SEARCHES}`, () => {
    for (const term of ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']) rememberSearch(term)

    expect(readRecentSearches()).toEqual(['a6', 'a5', 'a4', 'a3', 'a2'])
  })

  it('ignores a blank term', () => {
    rememberSearch('   ')

    expect(readRecentSearches()).toEqual([])
  })

  it('forgets one, or all', () => {
    rememberSearch('api')
    rememberSearch('billing')

    expect(forgetSearch('api')).toEqual(['billing'])
    expect(clearRecentSearches()).toEqual([])
    expect(readRecentSearches()).toEqual([])
  })

  it('reads damaged storage as nothing remembered', () => {
    localStorage.setItem('bit-connect-recent-searches', '{not json')

    expect(readRecentSearches()).toEqual([])
  })
})
