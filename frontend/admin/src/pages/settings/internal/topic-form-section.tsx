import { __, sprintf } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { Alert } from 'antd'

import { type TopicFieldMode, type TopicFormFieldsSettings } from '../shared/types'
import FieldModeRow from './field-mode-row'
import SectionCard from './section-card'

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
  const { plural, singular } = config.DEPARTMENT_NAMING

  return (
    <SectionCard
      subtitle={__('Choose what people fill in when they create a topic, besides its title and text.')}
      title={__('Topic form')}
    >
      <div className="bc-flex bc-flex-col bc-gap-3">
        <FieldModeRow
          description={__('What kind of post it is, such as a question or a bug report.')}
          disabled={disabled}
          label={__('Topic type')}
          onChange={mode => onChange('topicType', mode)}
          value={value.topicType}
        />
        <FieldModeRow
          // translators: %s: what the portal calls a department.
          description={sprintf(__('Which %s the topic is about.'), singular)}
          disabled={disabled}
          label={singular}
          // The sidebar lists topics by department, and a hidden field means
          // new topics carry none — worth saying before it is saved, not after
          // the list has quietly stopped growing.
          note={
            value.department === 'hidden' && (
              <Alert
                className="bc-mt-3"
                message={sprintf(
                  // translators: 1: what the portal calls departments, plural; 2: the same, singular.
                  __('New topics won’t belong to any of your %1$s, so they won’t appear when visitors browse by %2$s.'),
                  plural,
                  singular
                )}
                showIcon
                type="warning"
              />
            )
          }
          onChange={mode => onChange('department', mode)}
          value={value.department}
        />
      </div>
    </SectionCard>
  )
}
