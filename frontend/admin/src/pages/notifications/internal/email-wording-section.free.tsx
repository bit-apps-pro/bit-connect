import { __ } from '@common/helpers/i18nWrap'
import { Tag, Tooltip, Typography } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

import { type EmailWordingSectionProps } from './email-wording-section.pro'
import SectionCard from './section-card'

const { Text } = Typography

/**
 * Email wording without the add-on: the built-in lines, shown as text.
 *
 * The four lines the forum actually sends are read from `form`, which the
 * server has already resolved to the defaults for an unlicensed site — so this
 * shows the real wording rather than a sample of it. They are rendered as
 * quoted text and not as disabled inputs, for the same reason the delivery
 * section has no locked fields: a greyed-out box invites the reader to try to
 * type in it, and reads as a control that has broken rather than one that was
 * never theirs.
 */
export default function EmailWordingSectionFree({ form }: EmailWordingSectionProps) {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

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
      <div className="bc-mb-4 bc-flex bc-items-start bc-justify-between bc-gap-4">
        <Text className="bc-text-sm" type="secondary">
          {__('Notification emails use the wording below. Rewriting these lines comes with Pro.')}
        </Text>
        <Tooltip title={__('Custom email wording is a Pro feature.')}>
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
