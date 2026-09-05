import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import ModerationSectionFree from './moderation-section.free'
import ModerationSectionPro, { type ModerationSectionProps } from './moderation-section.pro'

/**
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 */
export default function ModerationSection(props: ModerationSectionProps) {
  return IS_PRO_ACTIVE ? <ModerationSectionPro {...props} /> : <ModerationSectionFree />
}
