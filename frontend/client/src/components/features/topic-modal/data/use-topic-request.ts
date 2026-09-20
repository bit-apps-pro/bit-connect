import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'
import { type Response } from '@common/helpers/request'

import { type SaveTopicPayload, type Topic } from '../shared/type'
import useTopicRequestFree from './use-topic-request.free'
import useTopicRequestPro from './use-topic-request.pro'

export interface TopicRequest {
  create: (data: SaveTopicPayload) => Promise<Response<Topic>>
  update: (data: SaveTopicPayload) => Promise<Response<Topic>>
}

/**
 * Where a topic is actually sent.
 *
 * An extension point around the request itself rather than around the endpoint
 * name, because the two implementations do not just POST to different paths:
 * this plugin has one endpoint that publishes, and the add-on has a second that
 * writes a private topic in one go. Saving a private topic by creating it
 * public and flipping it afterwards would leave it listed in public for the
 * length of a round trip, which in a privacy feature is a leak.
 *
 * Everything around the request — the validation-error mapping, the slug
 * disclosure, the cache invalidation — stays in use-save-topic and
 * use-update-topic and is shared. Only the call changes.
 *
 * Selected at module scope so the call site is one unconditional hook call.
 */
const useTopicRequest: () => TopicRequest = IS_PRO_ACTIVE ? useTopicRequestPro : useTopicRequestFree

export default useTopicRequest
