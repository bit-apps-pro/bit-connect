import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

import SectionCard from './section-card'

const { Text } = Typography

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
    <SectionCard subtitle={__('What happens to reported content')} title={__('Moderation')}>
      <Text className="bc-text-sm" type="secondary">
        {__(
          'Reported content stays visible until a moderator reviews the report and decides what to do with it.'
        )}
      </Text>
    </SectionCard>
  )
}
