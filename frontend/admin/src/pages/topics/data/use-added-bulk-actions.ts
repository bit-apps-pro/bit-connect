import { type TopicAction } from '../shared/types'

const NONE: TopicAction[] = []

/**
 * Further actions for the selected topics, offered before the table's own.
 *
 * Every action this plugin performs is already in the bar, so it adds none.
 * Each action runs itself and reports its own outcome; the page lets go of the
 * selection once it settles, as it does for its own.
 */
export default function useAddedBulkActions(): TopicAction[] {
  return NONE
}
