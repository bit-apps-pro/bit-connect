import isAddonActive from './addon-active.pro'

/**
 * Portal-side twin of the admin helper — see
 * frontend/admin/src/common/helpers/pro-access.ts.
 *
 * `BIT_CONNECT_PRO_BUILD` is the build-time bundle flag and folds to `false`
 * in this plugin's build, so every dispatch selects its `.free` sibling. The
 * second half is answered by another plugin's own `addon-active.pro` in its
 * build only.
 */
export const IS_PRO_ACTIVE = BIT_CONNECT_PRO_BUILD && isAddonActive()
