import config from '@config/config'
import isPro from '@plugin-commons/utils/isPro'

/**
 * Portal-side twin of the admin helper — see
 * frontend/admin/src/common/helpers/pro-access.ts for why both halves matter.
 *
 * `isPro()` is the build-time bundle flag; `config.IS_PRO` is the runtime
 * license answer. A pro bundle with an expired license must read as free.
 */
export const IS_PRO_ACTIVE = isPro() && config.IS_PRO

export const SHOW_PRO_UPSELL = !IS_PRO_ACTIVE
