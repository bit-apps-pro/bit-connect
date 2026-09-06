import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import BadgesColumnHeaderFree from './badges-column-header.free'
import BadgesColumnHeaderPro from './badges-column-header.pro'

/**
 * The Badges column heading.
 *
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 */
export default function BadgesColumnHeader() {
  return IS_PRO_ACTIVE ? <BadgesColumnHeaderPro /> : <BadgesColumnHeaderFree />
}
