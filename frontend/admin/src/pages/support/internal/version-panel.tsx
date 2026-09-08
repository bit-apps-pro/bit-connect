import isPro from '@plugin-commons/utils/isPro'

import { type VersionPanelProps } from '../shared/types'
import VersionPanelFree from './version-panel.free'
import VersionPanelPro from './version-panel.pro'

/**
 * Dispatch only — see the two siblings.
 *
 * Dispatches on `isPro()`, the build flag, and deliberately *not* on
 * `IS_PRO_ACTIVE`. Everywhere else in the app the licence half matters, because
 * an expired licence should read as free. Here it must not: this panel is where
 * the add-on's licence is entered, so gating it on the licence would leave a
 * pro install with no way to activate the licence it is missing.
 *
 * `isPro()` reads `import.meta.env.VITE_PRO`, which Vite replaces with a string
 * literal, so this folds to `false` in the free build and Rollup drops
 * `version-panel.pro` and everything it imports — which is the whole point:
 * WordPress.org does not permit a hosted plugin to carry licence machinery,
 * dormant or not (Plugin Directory guideline 6).
 */
export default function VersionPanel(props: VersionPanelProps) {
  return isPro() ? <VersionPanelPro {...props} /> : <VersionPanelFree {...props} />
}
