import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

const { Text } = Typography

/**
 * What the add-on adds to Topic Access: private topics.
 *
 * Described in a sentence rather than rendered as a switch: this plugin has no
 * endpoint that writes a private status and no setting that offers one. Both
 * are in the add-on, a separate plugin. Plain text, not a badge or a button —
 * the one link to the add-on is on the Support screen.
 */
export default function TopicAccessProNote() {
  return (
    <div className="bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-4">
      <Text className="bc-text-sm" type="secondary">
        {__(
          'Letting an author keep a topic private, so only they and the forum team can see it, comes with Bit Connect Pro — a separate add-on.'
        )}
      </Text>
    </div>
  )
}
