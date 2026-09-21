import isPro from '@plugin-commons/utils/isPro'

import isAddonActive from './addon-active.pro'

/**
 * Portal-side twin of the admin helper — see
 * frontend/admin/src/common/helpers/pro-access.ts.
 *
 * `isPro()` is the build-time bundle flag and folds to `false` in this
 * plugin's build, so every dispatch selects its `.free` sibling. The second
 * half is answered by the add-on's own `addon-active.pro` in its build only.
 */
export const IS_PRO_ACTIVE = isPro() && isAddonActive()

export const SHOW_PRO_UPSELL = !IS_PRO_ACTIVE
