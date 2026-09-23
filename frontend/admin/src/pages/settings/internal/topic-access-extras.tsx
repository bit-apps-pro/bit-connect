import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import TopicAccessExtrasFree from './topic-access-extras.free'
import TopicAccessExtrasPro from './topic-access-extras.pro'

/**
 * Whatever sits below the Topic Access switches.
 *
 * Dispatch only. In this plugin the slot is empty. Another plugin that adds a
 * topic-access setting of its own — one it stores and serves itself — renders
 * its control here through the other sibling.
 *
 * The slot exists so the settings screen never has to know which of those it
 * is rendering, and so such a switch is not a row in this plugin's settings
 * array writing to this plugin's option — a control here for behaviour that
 * only exists elsewhere is exactly the shape the split removes.
 */
export default function TopicAccessExtras() {
  return IS_PRO_ACTIVE ? <TopicAccessExtrasPro /> : <TopicAccessExtrasFree />
}
