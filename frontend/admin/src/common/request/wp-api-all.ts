import { wpApi } from './wp-api'

/** The most WordPress returns from a REST collection in one request. */
const PAGE_SIZE = 100

/**
 * Every item of a WordPress REST collection, however many pages it spans.
 *
 * One request returns at most 100, and a list read with a single request
 * stopped there without a word: past 100 tags the rest never reached the
 * screen, and neither search nor the Pending count could see them. Pages are
 * read until one comes back short.
 *
 * `wpApi` drops the response headers, so the total WordPress reports in them
 * is not available here. A list of exactly 100 therefore asks for a second
 * page. Term collections answer it empty; post collections refuse it with
 * `rest_*_invalid_page_number`, and that refusal ends the list too.
 */
export async function wpApiAll<T>(uri: string, { signal }: { signal?: AbortSignal } = {}): Promise<T[]> {
  const items: T[] = []

  for (let page = 1; ; page++) {
    let batch: T[]
    try {
      batch = (await wpApi<never, T[]>(uri, {
        method: 'GET',
        queryParam: { page, per_page: PAGE_SIZE },
        signal
      })) as unknown as T[]
    } catch (error) {
      if (page > 1 && isPastLastPage(error)) return items
      throw error
    }

    items.push(...batch)
    if (batch.length < PAGE_SIZE) return items
  }
}

/** WordPress's answer to a page number beyond the last: `rest_*_invalid_page_number`. */
function isPastLastPage(error: unknown) {
  const code = (error as { errors?: { code?: unknown } })?.errors?.code
  return typeof code === 'string' && code.endsWith('_invalid_page_number')
}
