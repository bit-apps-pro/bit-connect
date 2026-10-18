/**
 * The portal's own query names for the topics endpoint's filters.
 *
 * Members' items are posts, each filed under a topic, so the address bar says
 * `?topic=` and `?my_posts=` where the endpoint takes `topic-types` and
 * `my_topics`. The endpoint keeps its names; only the URL changes. The old
 * names are still read, so a link shared before the rename keeps its filter.
 */
const URL_NAMES: Record<string, string> = { my_topics: 'my_posts', 'topic-types': 'topic' }

/** The query name a filter takes in a portal URL. */
export const urlParam = (filter: string): string => URL_NAMES[filter] ?? filter

/** A filter's value from a portal URL, under its name or the one before it. */
export const readFilter = (params: URLSearchParams, filter: string): string =>
  params.get(urlParam(filter)) || params.get(filter) || ''

/** Remove a filter from a portal URL under both names. */
export function deleteFilter(params: URLSearchParams, filter: string): void {
  params.delete(urlParam(filter))
  params.delete(filter)
}
