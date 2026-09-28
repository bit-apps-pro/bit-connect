import { __ } from '@common/helpers/i18nWrap'
import { Button } from 'antd'
import { LuMail, LuSend } from 'react-icons/lu'

interface TestEmailRowProps {
  isSendingTest: boolean
  sendTestEmail: () => Promise<unknown>
}

/**
 * The test-email button and what it does.
 *
 * Not gated, and rendered by both editions of the Email delivery card: it
 * reports whether this site can send mail at all, which every forum needs
 * answered.
 */
export default function TestEmailRow({ isSendingTest, sendTestEmail }: TestEmailRowProps) {
  return (
    <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-4">
      <Button
        icon={<LuSend size={16} />}
        iconPosition="end"
        loading={isSendingTest}
        onClick={() => {
          sendTestEmail().catch(() => {
            // Reported by the hook.
          })
        }}
        size="large"
        type="primary"
      >
        {__('Send test email')}
      </Button>
      <span className="bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
        <LuMail aria-hidden size={14} />
        {__('Sent to your own address, using the settings as last saved.')}
      </span>
    </div>
  )
}
