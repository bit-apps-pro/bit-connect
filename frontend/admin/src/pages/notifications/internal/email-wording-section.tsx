import { __ } from '@common/helpers/i18nWrap'

import { type EmailWordingSectionProps } from '../shared/types'
import FieldLabel from './field-label'
import SectionCard from './section-card'
import StaticValue from './static-value'

/**
 * Email wording: the built-in lines, shown as text.
 *
 * The four lines the forum actually sends are read from `form`, which the
 * server has already resolved to this plugin's built-in wording — so this
 * shows the real wording rather than a sample of it. They are rendered as
 * text and not as inputs: this plugin has no setting for them.
 */
export default function EmailWordingSection({ form }: EmailWordingSectionProps) {
  const lines = [
    { key: 'mailGreeting', label: __('Greeting'), value: form.mailGreeting },
    { key: 'mailIntro', label: __('Intro for instant emails'), value: form.mailIntro },
    { key: 'mailDigestIntro', label: __('Intro for summary emails'), value: form.mailDigestIntro },
    { key: 'mailFooter', label: __('Footer'), value: form.mailFooter }
  ]

  return (
    <SectionCard
      subtitle={__('The lines before and after the notifications in each email.')}
      title={__('Email text')}
    >
      <div className="bc-flex bc-flex-col bc-gap-4">
        {lines.map(line => (
          <div key={line.key}>
            <FieldLabel>{line.label}</FieldLabel>
            <StaticValue>{line.value}</StaticValue>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
