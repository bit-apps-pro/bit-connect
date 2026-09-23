import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import useHasPrivateTopicsFree from './use-private-topics-available.free'
import useHasPrivateTopicsPro from './use-private-topics-available.pro'

/**
 * Whether this forum has private topics at all.
 *
 * Read by surfaces that only need to know the feature exists — the topic filter
 * offers a Private option, say — rather than by anything that writes a status.
 * This plugin answers no, because it has no code that makes a topic private;
 * a plugin that adds private topics answers through the other sibling.
 *
 * Callers still handle "no, but this visitor is already looking at private
 * topics": a bookmark pointing at that filter has to keep rendering, and an
 * existing private topic is readable on any install whatever this says.
 */
const useHasPrivateTopics: () => boolean = IS_PRO_ACTIVE
  ? useHasPrivateTopicsPro
  : useHasPrivateTopicsFree

export default useHasPrivateTopics
