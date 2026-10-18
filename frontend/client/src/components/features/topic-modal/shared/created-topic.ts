/**
 * Router state the create form leaves on the list it sends an author to, so
 * the topic they just wrote can be picked out in it.
 *
 * Carried in the history entry rather than the URL: it says what just
 * happened, not what the page lists, and a shared or bookmarked link should
 * not light up a topic for whoever opens it.
 */
export interface CreatedTopicState {
  createdTopicId: number
}

export function createdTopicId(state: unknown): number | undefined {
  if (typeof state !== 'object' || state === null || !('createdTopicId' in state)) return undefined

  return typeof state.createdTopicId === 'number' ? state.createdTopicId : undefined
}
