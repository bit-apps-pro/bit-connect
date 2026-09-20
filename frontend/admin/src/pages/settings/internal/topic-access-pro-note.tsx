import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text } = Typography

/**
 * What Topic Access does not include without the add-on: private topics.
 *
 * Described in a sentence rather than rendered as a switch forced off behind a
 * crown, for the same reason the moderation section describes rather than greys
 * out: a control for something this plugin cannot do was never a control, it
 * was an advertisement shaped like one — a feature locked pending payment.
 *
 * The server agrees, and is the real boundary. Private topics are not merely
 * switched off here: this plugin has no endpoint that writes the status and no
 * setting that offers it. Both ship in the add-on.
 *
 * Comment upvoting used to be named here too and is not any more. It is this
 * plugin's own feature — the votes, the counts, the sort and the profile
 * scoring are all here — so it has an ordinary switch in the grid above.
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
