import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import TopicAccessExtrasFree from './topic-access-extras.free'
import TopicAccessExtrasPro from './topic-access-extras.pro'

/**
 * Whatever sits below the Topic Access switches.
 *
 * Dispatch only. Without the add-on that is a sentence naming the one thing
 * this plugin does not do — see TopicAccessProNote. With it, it is the switch
 * that offers private topics, which the add-on stores and serves itself
 * because the feature behind it is entirely the add-on's.
 *
 * The slot exists so the free settings screen never has to know which of those
 * it is rendering, and so the switch is not a row in this plugin's settings
 * array writing to this plugin's option — a control here for behaviour that
 * only exists over there is exactly the shape the split removes.
 */
export default function TopicAccessExtras() {
  return IS_PRO_ACTIVE ? <TopicAccessExtrasPro /> : <TopicAccessExtrasFree />
}
