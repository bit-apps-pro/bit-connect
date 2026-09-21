import { __ } from '@common/helpers/i18nWrap'
import { Button, Modal } from 'antd'
import { useAtom } from 'jotai'
import { LuCheck, LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const PURCHASE_URL = 'https://bitapps.pro/bit-connect'

/**
 * What Pro adds.
 *
 * Hard-coded rather than fetched: this is marketing copy, it has to render
 * instantly on a site that may never reach bitapps.pro, and a network round
 * trip to decide what to sell is a spinner where a list should be.
 *
 * **This list may only name features this plugin does not implement.** Each
 * one is code that exists only in the add-on, a separate plugin:
 *
 * - private topics      the endpoint, the setting and the form option
 * - profile badges      the catalog, its routes and assignment
 * - auto-hide           the policy answering `bit_connect_should_auto_hide`
 * - sender identity,    the stored values answering the mail filters that
 *   email wording       NotificationSettings::fromName(), fromEmail() and
 *                       template() ask
 *
 * Never list something this plugin already does — an upsell for a feature the
 * reader already has is worse than no upsell at all.
 */
const PRO_FEATURES = [
  __('Private topics, visible only to the people you choose'),
  __('Profile badges you author and hand out'),
  __('Hide reported content automatically, before a moderator gets to it'),
  __('Send forum email from your own name and address'),
  __('Write your own wording for every notification email')
]

/**
 * The single upsell modal, mounted once beside the router.
 *
 * Every pro affordance in the app opens this one instance through
 * `$isBuyProModalOpen`, so the copy stays in one place and no screen has to
 * carry its own modal.
 */
export default function BuyPro() {
  const [isOpen, setIsOpen] = useAtom($isBuyProModalOpen)

  return (
    <Modal
      centered
      footer={[
        <Button key="later" onClick={() => setIsOpen(false)}>
          {__('Maybe later')}
        </Button>,
        <Button
          href={PURCHASE_URL}
          icon={<LuCrown size={16} />}
          key="buy"
          rel="noreferrer noopener"
          target="_blank"
          type="primary"
        >
          {__('Get Bit Connect Pro')}
        </Button>
      ]}
      onCancel={() => setIsOpen(false)}
      open={isOpen}
      title={__('Bit Connect Pro')}
    >
      <p className="bc-mb-3 bc-text-ink-muted">{__('Bit Connect Pro adds:')}</p>
      <ul className="bc-m-0 bc-flex bc-list-none bc-flex-col bc-gap-2 bc-p-0">
        {PRO_FEATURES.map(feature => (
          <li className="bc-flex bc-items-start bc-gap-2 bc-text-sm" key={feature}>
            <LuCheck className="bc-mt-0.5 bc-shrink-0 bc-text-primary" size={16} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
