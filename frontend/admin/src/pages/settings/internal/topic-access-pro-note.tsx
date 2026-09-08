import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text } = Typography

/**
 * What Topic Access looks like without the add-on: two features, stated.
 *
 * These used to be rows in the grid above, rendered as switches forced off and
 * disabled behind a crown. They are described in a sentence instead, for the
 * same reason the moderation and email-wording sections describe rather than
 * grey out: this plugin has no comment-upvote and no private-topic code to
 * switch on, so a control for either was never a control — it was an
 * advertisement shaped like one, which is what Plugin Directory guideline 6
 * calls a feature locked pending payment.
 *
 * The server agrees, and is the real boundary: `ProFeatures::commentUpvotes()`
 * and `ProFeatures::privateTopics()` answer `false` with no listener attached,
 * so the settings never take effect regardless of what a client posts.
 */
export default function TopicAccessProNote() {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <div className="bc-flex bc-items-start bc-justify-between bc-gap-4 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4">
      <Text className="bc-text-sm" type="secondary">
        {__(
          'Members can upvote topics and reply to them. Upvoting individual replies, and letting an author keep a topic private so only they and the forum team can see it, come with Bit Connect Pro — a separate add-on.'
        )}
      </Text>
      <Tooltip title={__('Comment Upvote and Private Topic are Pro features.')}>
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
