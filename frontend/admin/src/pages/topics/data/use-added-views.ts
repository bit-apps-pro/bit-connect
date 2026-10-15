import { type TopicListView } from '../shared/types'

const NONE: TopicListView[] = []

/**
 * Further named lists of topics offered beside the table's own, each sent to
 * the server as `view` — see ExtensionPoints::topicListQuery().
 *
 * This plugin's own list is narrowed by its filters, so it offers none, and the
 * page draws no tabs.
 */
export default function useAddedViews(): TopicListView[] {
  return NONE
}
