import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text } = Typography

/**
 * What topic access gains with the add-on, said in words.
 *
 * The two settings named here are not rendered as switches above, because
 * without the add-on there is no setting to make: the server does not offer
 * comment upvotes or private topics at all (ProFeatures::commentUpvotes,
 * ProFeatures::privateTopics), so a stored value would change nothing. A switch
 * held off would be describing a control this forum does not have, which is the
 * shape the plugin directory guidelines rule out — and the same reason the
 * moderation and email-wording sections state their pro features rather than
 * greying out a field.
 */
export default function TopicAccessProNote() {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  const features = [
    {
      description: __('Let members upvote replies as well as topics.'),
      key: 'commentUpvote',
      label: __('Comment Upvote')
    },
    {
      description: __('Let authors keep a topic visible only to them and the forum team.'),
      key: 'privateTopic',
      label: __('Private Topic')
    }
  ]

  return (
    <div className="bc-bg-surface bc-p-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-mb-6">
      <div className="bc-mb-4 bc-flex bc-items-start bc-justify-between bc-gap-4">
        <Text className="bc-text-sm" type="secondary">
          {__('Two more things members can do on a topic come with Bit Connect Pro.')}
        </Text>
        <Tooltip title={__('Available with Bit Connect Pro.')}>
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

      <dl className="bc-m-0 bc-grid bc-grid-cols-1 bc-gap-3 md:bc-grid-cols-2">
        {features.map(feature => (
          <div
            className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4"
            key={feature.key}
          >
            <dt className="bc-mb-1">
              <Text strong>{feature.label}</Text>
            </dt>
            <dd className="bc-m-0">
              <Text className="bc-text-sm" type="secondary">
                {feature.description}
              </Text>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
