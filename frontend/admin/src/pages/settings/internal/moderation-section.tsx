import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import ModerationSectionFree from './moderation-section.free'
import ModerationSectionPro from './moderation-section.pro'

/**
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 *
 * No props: this plugin's settings form holds nothing for either sibling to
 * read or write. The free one states what happens to a reported post; the
 * add-on's keeps its own number, behind its own endpoint.
 */
export default function ModerationSection() {
  return IS_PRO_ACTIVE ? <ModerationSectionPro /> : <ModerationSectionFree />
}
