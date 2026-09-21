import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

import { type EmailWordingSectionProps } from '../shared/types'
import SectionCard from './section-card'

const { Text } = Typography

/**
 * Email wording without the add-on: the built-in lines, shown as text.
 *
 * The four lines the forum actually sends are read from `form`, which the
 * server has already resolved to this plugin's built-in wording — so this
 * shows the real wording rather than a sample of it. They are rendered as
 * quoted text and not as inputs: this plugin has no setting for them.
 */
export default function EmailWordingSectionFree({ form }: EmailWordingSectionProps) {
  const lines = [
    { key: 'mailGreeting', label: __('Greeting'), value: form.mailGreeting },
    { key: 'mailIntro', label: __('Instant email intro'), value: form.mailIntro },
    { key: 'mailDigestIntro', label: __('Digest intro'), value: form.mailDigestIntro },
    { key: 'mailFooter', label: __('Sign-off'), value: form.mailFooter }
  ]

  return (
    <SectionCard
      subtitle={__('The wording around the list of what happened.')}
      title={__('Email wording')}
    >
      <Text className="bc-mb-4 bc-block bc-text-sm" type="secondary">
        {__('Notification emails use the wording below. Rewriting these lines comes with Pro.')}
      </Text>

      <dl className="bc-m-0 bc-flex bc-flex-col bc-gap-3">
        {lines.map(line => (
          <div key={line.key}>
            <dt className="bc-mb-0.5 bc-text-xs bc-text-ink-subtle">{line.label}</dt>
            <dd className="bc-m-0 bc-border-0 bc-border-s-2 bc-border-solid bc-border-s-line bc-ps-3 bc-text-sm bc-text-ink">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
