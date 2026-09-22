import { __ } from '@common/helpers/i18nWrap'
import { Button, Divider } from 'antd'
import { LuMailCheck, LuSend } from 'react-icons/lu'

import { type EmailDeliverySectionProps } from '../shared/types'
import SectionCard from './section-card'

/**
 * Email delivery without the add-on: what the forum will send as, stated.
 *
 * No inputs, because this plugin has no sender setting: it sends as the site's
 * own identity (NotificationSettings::fromName/fromEmail).
 *
 * The test-email button stays. Whether mail leaves this server at all is a
 * question every forum needs answered, and it is not what the add-on sells.
 */
export default function EmailDeliverySectionFree({
  isSendingTest,
  payload,
  sendTestEmail
}: EmailDeliverySectionProps) {
  return (
    <SectionCard subtitle={__('Who forum email appears to come from.')} title={__('Email delivery')}>
      <div className="bc-mb-4 bc-text-sm">
        <div className="bc-mb-1 bc-text-ink">
          {__('Notifications are sent as')}{' '}
          <span className="bc-font-medium">{payload.effectiveSender.name}</span>{' '}
          <span className="bc-text-ink-subtle">&lt;{payload.effectiveSender.email}&gt;</span>
        </div>
        <div className="bc-text-xs bc-text-ink-subtle">
          {__(
            'Taken from your site title and address. A custom sender is a feature of Bit Connect Pro, a separate plugin.'
          )}
        </div>
      </div>

      <Divider className="bc-my-4" />

      <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-3">
        <Button
          icon={<LuSend size={14} />}
          loading={isSendingTest}
          onClick={() => {
            sendTestEmail().catch(() => {
              // Reported by the hook.
            })
          }}
        >
          {__('Send test email')}
        </Button>
        <span className="bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
          <LuMailCheck size={13} />
          {__('Sent to your own address, using the settings as last saved.')}
        </span>
      </div>
    </SectionCard>
  )
}
