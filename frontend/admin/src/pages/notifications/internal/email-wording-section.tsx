import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import EmailWordingSectionFree from './email-wording-section.free'
import EmailWordingSectionPro, { type EmailWordingSectionProps } from './email-wording-section.pro'

/**
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 */
export default function EmailWordingSection(props: EmailWordingSectionProps) {
  return IS_PRO_ACTIVE ? <EmailWordingSectionPro {...props} /> : <EmailWordingSectionFree {...props} />
}
