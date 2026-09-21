import isPro from '@plugin-commons/utils/isPro'

import { type VersionPanelProps } from '../shared/types'
import VersionPanelFree from './version-panel.free'
import VersionPanelPro from './version-panel.pro'

/**
 * Dispatch only — see the two siblings.
 *
 * Dispatches on `isPro()`, the build flag, which Vite replaces with a string
 * literal: this folds to `false` in this plugin's build and Rollup drops
 * `version-panel.pro` and everything it imports. The add-on's build supplies
 * its own panel from its own tree.
 */
export default function VersionPanel(props: VersionPanelProps) {
  return isPro() ? <VersionPanelPro {...props} /> : <VersionPanelFree {...props} />
}
