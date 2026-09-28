import { __ } from '@common/helpers/i18nWrap'
import { Divider } from 'antd'

import { type EmailDeliverySectionProps } from '../shared/types'
import DigestScheduleFields from './digest-schedule-fields'
import FieldLabel from './field-label'
import SectionCard from './section-card'
import StaticValue from './static-value'
import TestEmailRow from './test-email-row'

/**
 * Email delivery: what the forum will send as, and when digests go out.
 *
 * The sender is stated, not asked for, because this plugin has no sender
 * setting: it sends as the site's own identity
 * (NotificationSettings::fromName/fromEmail).
 *
 * The test-email button stays. Whether mail leaves this server at all is a
 * question every forum needs answered.
 */
export default function EmailDeliverySection({
  enabled,
  form,
  isSendingTest,
  payload,
  sendTestEmail,
  set
}: EmailDeliverySectionProps) {
  return (
    <SectionCard
      subtitle={__('Who forum email appears to come from, and when digests go out.')}
      title={__('Email delivery')}
    >
      <div className="bc-grid bc-gap-4 sm:bc-grid-cols-2">
        <div>
          <FieldLabel>{__('Sender name')}</FieldLabel>
          <StaticValue>{payload.effectiveSender.name}</StaticValue>
        </div>
        <div>
          <FieldLabel>{__('Sender address')}</FieldLabel>
          <StaticValue>{payload.effectiveSender.email}</StaticValue>
        </div>
      </div>
      <div className="bc-mt-1.5 bc-text-xs bc-text-ink-subtle">
        {__('Taken from your site title and address.')}
      </div>

      <div className="bc-mt-5">
        <DigestScheduleFields
          enabled={enabled}
          form={form}
          frequencies={payload.frequencies}
          set={set}
        />
      </div>

      <Divider className="bc-my-5" />

      <TestEmailRow isSendingTest={isSendingTest} sendTestEmail={sendTestEmail} />
    </SectionCard>
  )
}
