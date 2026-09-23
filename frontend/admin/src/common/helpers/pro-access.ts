import isAddonActive from './addon-active.pro'

/**
 * Which of a split feature's two implementations a dispatcher selects.
 *
 * `BIT_CONNECT_PRO_BUILD` is a build-time literal, defined by the Vite config:
 * is this another plugin's bundle, built over this tree? In this plugin's own
 * build it is `false`, so the `&&` short-circuits, every dispatch folds to its
 * `.free` sibling, and Rollup drops the other side together with everything
 * it imports. This plugin's code never looks further.
 *
 * The second half exists only for such a build, which answers it through its
 * own `addon-active.pro` module. None of that lives in this repository — the
 * stub beside this file answers `false` and is never reached here.
 */
export const IS_PRO_ACTIVE = BIT_CONNECT_PRO_BUILD && isAddonActive()
