import { __ } from '@common/helpers/i18nWrap'

import { type TopicFieldMode, type TopicFormFieldsSettings } from '../shared/types'
import FieldModeRow from './field-mode-row'
import SectionCard from './section-card'
import TopicFormExtras from './topic-form-extras'

interface TopicFormSectionProps {
  disabled?: boolean
  onChange: (field: keyof TopicFormFieldsSettings, mode: TopicFieldMode) => void
  value: TopicFormFieldsSettings
}

/**
 * What the portal's "create a topic" form asks for beyond a title and a body.
 *
 * "Required" is enforced by the server too (CreateTopicRequest), so it holds
 * for every way a topic gets created, not just this plugin's form.
 */
export default function TopicFormSection({ disabled = false, onChange, value }: TopicFormSectionProps) {
  return (
    <SectionCard
      subtitle={__('Choose what people fill in when they create a post, in addition to its title and text.')}
      title={__('Post form')}
    >
      <div className="bc-flex bc-flex-col bc-gap-3">
        <FieldModeRow
          description={__('The category of the post, such as a question or a bug report.')}
          disabled={disabled}
          label={__('Post category')}
          onChange={mode => onChange('topicType', mode)}
          value={value.topicType}
        />
        {TopicFormExtras && <TopicFormExtras />}
      </div>
    </SectionCard>
  )
}
