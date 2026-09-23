import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

const { Text, Title } = Typography

/**
 * What happens to a reported post, stated.
 *
 * No number field and no heading shaped like a switch, because there is
 * nothing to set: reported content stays where it is until a moderator has
 * looked at it. ReportService asks the public `bit_connect_should_auto_hide`
 * filter and, with nobody answering, the answer is no.
 */
export default function ModerationSection() {
  return (
    <div className="bc-bg-surface bc-p-6 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-mb-6">
      <div className="bc-mb-4">
        <Title className="bc-mb-1" level={4}>
          {__('Moderation')}
        </Title>
        <Text type="secondary">{__('What happens to reported content')}</Text>
      </div>

      <Text className="bc-text-sm" type="secondary">
        {__(
          'Reported content stays visible until a moderator reviews the report and decides what to do with it.'
        )}
      </Text>
    </div>
  )
}
