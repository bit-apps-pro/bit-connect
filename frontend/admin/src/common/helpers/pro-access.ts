import config from '@config/config'
import isPro from '@plugin-commons/utils/isPro'

/**
 * Pro access has two independent halves that can disagree:
 *
 * - `isPro()` is a build-time literal: is this the pro bundle?
 * - `config.IS_PRO` is a runtime server variable: is the license valid?
 *
 * They come apart in real situations — most often a pro bundle served with an
 * expired license, which is also the normal state during development. Deciding
 * per-component on one half or the other is how a UI ends up showing a crown
 * next to a working feature, or a locked preview of something the user paid
 * for. Everything upsell-related reads these two constants so it all agrees.
 */
export const IS_PRO_ACTIVE = isPro() && config.IS_PRO

export const SHOW_PRO_UPSELL = !IS_PRO_ACTIVE
