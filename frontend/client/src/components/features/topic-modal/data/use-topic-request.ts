import queryRequest from '@common/helpers/request'
import { type Response } from '@common/helpers/request'

import { type SaveTopicPayload, type Topic } from '../shared/type'

export interface TopicRequest {
  create: (data: SaveTopicPayload) => Promise<Response<Topic>>
  update: (data: SaveTopicPayload) => Promise<Response<Topic>>
}

/**
 * One endpoint each way, because this plugin publishes topics and does nothing
 * else with their visibility.
 *
 * A constant: there is nothing to decide per payload, and the visibility radio
 * only ever offers Public here.
 */
const TOPIC_REQUEST: TopicRequest = {
  create: (data: SaveTopicPayload) => queryRequest<Topic>('topics', data),
  update: (data: SaveTopicPayload) => queryRequest<Topic>(`topics/${data.topic_id}`, data)
}

/**
 * Where a topic is actually sent.
 *
 * Kept behind a hook rather than called inline so that everything around the
 * request — the validation-error mapping, the slug disclosure, the cache
 * invalidation — stays in use-save-topic and use-update-topic and is shared,
 * whatever the call itself turns out to be.
 */
export default function useTopicRequest(): TopicRequest {
  return TOPIC_REQUEST
}
