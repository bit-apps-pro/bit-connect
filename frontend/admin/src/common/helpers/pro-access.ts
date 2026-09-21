import isPro from '@plugin-commons/utils/isPro'

import isAddonActive from './addon-active.pro'

/**
 * Which of a split feature's two implementations a dispatcher selects.
 *
 * `isPro()` is a build-time literal: is this the Bit Connect Pro add-on's
 * bundle? In this plugin's own build it is `false`, so the `&&` short-circuits,
 * every dispatch folds to its `.free` sibling, and Rollup drops the other side
 * together with everything it imports. This plugin's code never looks further.
 *
 * The second half exists only for the add-on's build, where the add-on answers
 * it through its own `addon-active.pro` module. What decides that answer is the
 * add-on's business and none of it lives in this repository — the stub beside
 * this file answers `false` and is never reached here.
 */
export const IS_PRO_ACTIVE = isPro() && isAddonActive()
