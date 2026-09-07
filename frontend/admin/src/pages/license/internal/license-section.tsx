import isPro from '@plugin-commons/utils/isPro'

import LicenseSectionFree from './license-section.free'
import LicenseSectionPro from './license-section.pro'

/**
 * Dispatch only — see the two siblings.
 *
 * The flag here is `isPro()` and deliberately not `IS_PRO_ACTIVE`. Those two
 * differ in exactly the case this screen exists to serve: a pro bundle whose
 * licence is missing or expired, where the activation UI is the one thing the
 * user needs to reach. `IS_PRO_ACTIVE` folds in the licence as well, so it
 * would hide the activation form from precisely the people looking for it.
 *
 * `isPro()` is `import.meta.env.VITE_PRO`, a literal at build time, so the free
 * bundle keeps only the free branch and Rollup drops the other.
 */
export default function LicenseSection() {
  return isPro() ? <LicenseSectionPro /> : <LicenseSectionFree />
}
