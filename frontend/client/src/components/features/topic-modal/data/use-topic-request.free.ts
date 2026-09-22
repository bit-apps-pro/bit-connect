import queryRequest from '@common/helpers/request'

import { type SaveTopicPayload, type Topic } from '../shared/type'
import { type TopicRequest } from './use-topic-request'

/**
 * One endpoint each way, because this plugin publishes topics and does nothing
 * else with their visibility.
 *
 * A constant: there is nothing to decide per payload, and the visibility radio
 * only ever offers Public here.
 */
const FREE_TOPIC_REQUEST: TopicRequest = {
  create: (data: SaveTopicPayload) => queryRequest<Topic>('topics', data),
  update: (data: SaveTopicPayload) => queryRequest<Topic>(`topics/${data.topic_id}`, data)
}

export default function useTopicRequestFree(): TopicRequest {
  return FREE_TOPIC_REQUEST
}
