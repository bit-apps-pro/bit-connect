import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

const { Text, Title } = Typography

/**
 * Moderation without the add-on: what happens to a reported post, stated.
 *
 * No number field, because there is no number to set — the server does not
 * auto-hide at all without a licence (ReportService::shouldAutoHide), so a
 * spinner holding "2" would be describing behaviour this forum does not have.
 *
 * Reporting itself and the moderation queue are free and unaffected. What the
 * add-on sells is acting on reports *before* a moderator has looked, so that is
 * what this section offers, and it takes no props for the same reason the free
 * badges cell takes none: there is nothing here to change.
 */
export default function ModerationSectionFree() {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <div className="bc-bg-surface bc-p-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-mb-6">
      <div className="bc-mb-4">
        <Title className="bc-mb-1" level={4}>
          {__('Moderation')}
        </Title>
        <Text type="secondary">
          {__('Control what happens to reported content before a moderator has looked at it')}
        </Text>
      </div>

      <div className="bc-bg-surface bc-p-4 bc-rounded-md bc-border bc-border-solid bc-border-line md:bc-max-w-md">
        <div className="bc-mb-3 bc-flex bc-items-start bc-justify-between bc-gap-4">
          <Text strong>{__('Hide content automatically')}</Text>
          <Tooltip title={__('Hiding content on report count is a Pro feature.')}>
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
        <Text className="bc-text-sm" type="secondary">
          {__(
            'Reported content stays visible until a moderator decides. With Pro, a topic or reply is taken out of public view once enough different members have reported it, and comes back if a moderator keeps it.'
          )}
        </Text>
      </div>
    </div>
  )
}
