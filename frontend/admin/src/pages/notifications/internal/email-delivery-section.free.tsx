import { __ } from '@common/helpers/i18nWrap'
import { Button, Divider, Tag, Tooltip } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown, LuMailCheck, LuSend } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

import { type EmailDeliverySectionProps } from './email-delivery-section.pro'
import SectionCard from './section-card'

/**
 * Email delivery without the add-on: what the forum will send as, stated.
 *
 * No inputs, because there is nothing here a free site can change — the server
 * ignores a submitted sender and reads the site's own identity instead
 * (NotificationSettings::fromName/fromEmail). Showing disabled fields holding
 * values that are really WordPress's would suggest the forum has its own
 * setting that happens to be locked, which is not what is true.
 *
 * The test-email button stays. Whether mail leaves this server at all is a
 * question every forum needs answered, and it is not what the add-on sells.
 */
export default function EmailDeliverySectionFree({
  isSendingTest,
  payload,
  sendTestEmail
}: EmailDeliverySectionProps) {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  return (
    <SectionCard subtitle={__('Who forum email appears to come from.')} title={__('Email delivery')}>
      <div className="bc-mb-4 bc-flex bc-items-start bc-justify-between bc-gap-4">
        <div className="bc-text-sm">
          <div className="bc-mb-1 bc-text-ink">
            {__('Notifications are sent as')}{' '}
            <span className="bc-font-medium">{payload.effectiveSender.name}</span>{' '}
            <span className="bc-text-ink-subtle">&lt;{payload.effectiveSender.email}&gt;</span>
          </div>
          <div className="bc-text-xs bc-text-ink-subtle">
            {__(
              'Taken from your site title and address. A custom sender, and daily or weekly digests, come with Pro.'
            )}
          </div>
        </div>
        <Tooltip title={__('A custom sender and digest schedule are Pro features.')}>
          <Tag
            className="bc-m-0 bc-shrink-0 bc-cursor-pointer"
            color="gold"
            icon={<LuCrown className="bc-mr-1 bc-inline" size={12} />}
            onClick={() => setBuyProOpen(true)}
          >
            {__('Pro')}
          </Tag>
        </Tooltip>
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
