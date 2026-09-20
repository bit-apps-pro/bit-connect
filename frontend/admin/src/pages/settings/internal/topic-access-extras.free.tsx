import TopicAccessProNote from './topic-access-pro-note'

/**
 * Without the add-on: the note, and nothing else.
 *
 * A thin wrapper so the dispatch has two real siblings. The note itself is
 * unchanged and is still the only thing this plugin shows below the Topic
 * Access switches.
 */
export default function TopicAccessExtrasFree() {
  return <TopicAccessProNote />
}
