import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import useCapabilityGroupsFree from './use-capability-groups.free'
import useCapabilityGroupsPro from './use-capability-groups.pro'

export interface CapabilityGroup {
  caps: string[]
  label: string
}

/**
 * Extra rows for the role capabilities matrix.
 *
 * The matrix is built from this plugin's own groups plus whatever this
 * returns. It is empty without the add-on, which is the honest answer: a
 * capability this forum does not recognise has no row, rather than a row that
 * grants something nothing reads. The server agrees — the roles screen is
 * saved against ExtensionPoints::capabilities(), and a slug not named there is
 * not stored.
 *
 * Selected at module scope; the two sides are hooks.
 */
const useCapabilityGroups: () => CapabilityGroup[] = IS_PRO_ACTIVE
  ? useCapabilityGroupsPro
  : useCapabilityGroupsFree

export default useCapabilityGroups
