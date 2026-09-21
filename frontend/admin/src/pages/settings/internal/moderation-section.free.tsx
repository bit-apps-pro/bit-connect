import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

const { Text, Title } = Typography

/**
 * Moderation without the add-on: what happens to a reported post, stated.
 *
 * No number field, because there is no number to set. This plugin holds no
 * code that hides anything on a report count: ReportService asks the public
 * `bit_connect_should_auto_hide` filter and, with nobody answering, the answer
 * is no. A spinner holding "2" would be describing behaviour this forum does
 * not have rather than a setting it declines to save.
 *
 * Reporting itself and the moderation queue are free and unaffected. What the
 * add-on sells is acting on reports *before* a moderator has looked, so that is
 * what this section offers, and it takes no props for the same reason the free
 * badges cell takes none: there is nothing here to change.
 */
export default function ModerationSectionFree() {
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
        <Text className="bc-mb-3 bc-block" strong>
          {__('Hide content automatically')}
        </Text>
        <Text className="bc-text-sm" type="secondary">
          {__(
            'Reported content stays visible until a moderator decides. With Pro, a topic or reply is taken out of public view once enough different members have reported it, and comes back if a moderator keeps it.'
          )}
        </Text>
      </div>
    </div>
  )
}
