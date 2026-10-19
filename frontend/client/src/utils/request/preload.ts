/**
 * The app's first GET requests, answered by the server in the page itself.
 *
 * Each request the portal sent when it started was a full WordPress load and a
 * network round trip; on a slow host that was a second or more for each wave,
 * before the page showed its content. The server runs the same routes while it
 * draws the page (PortalPreload.php) and prints the answers in the config.
 *
 * Each answer is read once, for the first request that asks for it, and then
 * forgotten: a later request for the same data — a refresh after a write, for
 * example — must reach the server, or it would show the page's copy again.
 */

// Seeds SERVER_VARIABLES where no build `define` stands in for it (tests).
import '@config/config'

/**
 * One key for a request however its URL was written: the REST route with its
 * query sorted, with or without the `/wp-json` prefix, and for a site with plain
 * permalinks, whose routes travel in `?rest_route=`.
 */
export const preloadKey = (url: URL): string => {
  const params = new URLSearchParams(url.search)
  const route = params.get('rest_route') ?? url.pathname.replace(/^.*?\/wp-json(?=\/)/, '')

  params.delete('rest_route')
  params.sort()

  const query = params.toString()

  return query ? `${route}?${query}` : route
}

const answers = new Map<string, unknown>()

const seed = typeof SERVER_VARIABLES === 'undefined' ? undefined : SERVER_VARIABLES.preload

for (const [path, body] of Object.entries(seed ?? {})) {
  // The server's keys are bare paths; any base makes them a URL to read.
  answers.set(preloadKey(new URL(path, 'https://preload.invalid')), body)
}

/**
 * The page's answer to this request, if it has one and nothing read it yet.
 * GET only: nothing else is preloaded, and nothing else is safe to skip.
 *
 * @returns the response body, or undefined when the request must be sent
 */
export function takePreloaded(url: URL, method = 'GET'): unknown {
  if (method.toUpperCase() !== 'GET') return undefined

  const key = preloadKey(url)
  if (!answers.has(key)) return undefined

  const body = answers.get(key)
  answers.delete(key)

  return body
}
