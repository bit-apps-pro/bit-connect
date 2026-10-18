/**
 * The last few terms this browser searched for, newest first.
 *
 * A convenience, never state anything depends on: storage can be missing (a
 * server render), blocked (a private window) or full, and every one of those
 * reads as an empty list rather than an error.
 */

const STORAGE_KEY = 'bit-connect-recent-searches'
export const MAX_RECENT_SEARCHES = 5

function write(terms: string[]) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(terms))
  } catch {
    // Unwritable storage just means nothing is remembered.
  }
}

export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '[]')

    return Array.isArray(parsed)
      ? parsed.filter((term): term is string => typeof term === 'string' && term !== '').slice(0, MAX_RECENT_SEARCHES)
      : []
  } catch {
    return []
  }
}

/** Move a term to the front, once — searching "API" after "api" keeps the newer spelling. */
export function rememberSearch(term: string): string[] {
  const next = term.trim()
  if (next === '') return readRecentSearches()

  const terms = [
    next,
    ...readRecentSearches().filter(previous => previous.toLowerCase() !== next.toLowerCase())
  ].slice(0, MAX_RECENT_SEARCHES)
  write(terms)

  return terms
}

export function forgetSearch(term: string): string[] {
  const terms = readRecentSearches().filter(previous => previous !== term)
  write(terms)

  return terms
}

export function clearRecentSearches(): string[] {
  write([])

  return []
}
