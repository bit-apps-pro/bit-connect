/** A named list of topics, chosen from the sort control and sent as `?view=`. */
export interface ListingView {
  label: string
  /** The name the topics endpoint is asked for — see ExtensionPoints::topicListQuery(). */
  value: string
}

const NONE: ListingView[] = []

/**
 * Further lists the sort control offers beside its orderings, if a plugin
 * adds any.
 *
 * This plugin's own list is its filters; it names no list of its own, so the
 * answer is none.
 */
export default function useAddedViews(): ListingView[] {
  return NONE
}
