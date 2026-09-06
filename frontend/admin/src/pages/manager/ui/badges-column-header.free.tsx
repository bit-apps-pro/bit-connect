import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

/**
 * The Badges column heading, carrying the one upsell this column gets.
 *
 * It sits in the header rather than in every row on purpose. The cells below
 * repeat once per member — on a site with a few hundred users that is a few
 * hundred identical Buy Pro buttons, which is an advert wearing a table's
 * clothes. One tag at the top says the same thing once, and the cells stay
 * quiet.
 */
export default function BadgesColumnHeaderFree() {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <div className="bc-flex bc-items-center bc-gap-2">
      <span>{__('Badges')}</span>
      <Tooltip title={__('Profile badges are a Pro feature.')}>
        <Tag
          className="bc-m-0 bc-cursor-pointer bc-normal-case"
          color="gold"
          icon={<LuCrown className="bc-mr-1 bc-inline" size={10} />}
          onClick={() => setBuyProOpen(true)}
        >
          {__('Pro')}
        </Tag>
      </Tooltip>
    </div>
  )
}
