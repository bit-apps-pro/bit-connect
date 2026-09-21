import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text } = Typography

/**
 * What the add-on adds to Topic Access: private topics.
 *
 * Described in a sentence rather than rendered as a switch: this plugin has no
 * endpoint that writes a private status and no setting that offers one. Both
 * are in the add-on, a separate plugin.
 */
export default function TopicAccessProNote() {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <div className="bc-flex bc-items-start bc-justify-between bc-gap-4 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4">
      <Text className="bc-text-sm" type="secondary">
        {__(
          'Letting an author keep a topic private, so only they and the forum team can see it, comes with Bit Connect Pro — a separate add-on.'
        )}
      </Text>
      <Tooltip title={__('Private Topic is a Pro feature.')}>
        <Tag
          className="bc-m-0 bc-shrink-0 bc-cursor-pointer"
          color="gold"
          icon={<LuCrown className="bc-mr-1 bc-inline" size={12} />}
          onClick={() => setBuyProOpen(true)}
        >
          {__('Pro')}
        </Tag>
      </Tooltip>
    </div>
  )
}
