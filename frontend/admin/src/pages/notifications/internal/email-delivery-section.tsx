import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import { type EmailDeliverySectionProps } from '../shared/types'
import EmailDeliverySectionFree from './email-delivery-section.free'
import EmailDeliverySectionPro from './email-delivery-section.pro'

/**
 * Dispatch only — see the two siblings. `IS_PRO_ACTIVE` folds to a literal in
 * the free build, so Rollup keeps exactly one of them.
 */
export default function EmailDeliverySection(props: EmailDeliverySectionProps) {
  return IS_PRO_ACTIVE ? <EmailDeliverySectionPro {...props} /> : <EmailDeliverySectionFree {...props} />
}
