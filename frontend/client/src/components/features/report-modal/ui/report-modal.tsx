import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { Alert, Input, Modal, Radio, Space, Typography } from 'antd'
import { useContext, useEffect, useState } from 'react'

import useReportContent, { useReportReasons } from '../data/use-report-content'
import useReportModalStore from '../state/use-report-modal-store'

const { Paragraph, Text } = Typography

/** Mirrors ReportReasons::requiresDetails() — the server refuses without it. */
const REQUIRES_DETAILS = 'other'

/** Matches the max on CreateReportRequest, so the server never has to refuse. */
const DETAILS_LIMIT = 2000

/** Strips tags: the excerpt is stored HTML, shown here as plain text. */
const plain = (html: string) =>
  html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

/**
 * The report dialog, mounted once for the page.
 *
 * Opened from a comment row or a topic header through the store, which carries
 * what is being reported — a thread has hundreds of rows and needs one dialog,
 * not hundreds.
 */
export default function ReportModal() {
  const { close, isOpen, target } = useReportModalStore()
  const { notificationApi } = useContext(NotifyContext)
  const { isReasonsError, isReasonsFetching, reasons } = useReportReasons(isOpen)
  const { isReporting, report } = useReportContent()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')

  // Reset between openings: without this the next report opens pre-filled with
  // the last one's reason, which is an easy way to file the wrong thing.
  useEffect(() => {
    if (isOpen) {
      setReason('')
      setDetails('')
    }
  }, [isOpen])

  const needsDetails = reason === REQUIRES_DETAILS
  // No reasons means nothing can be chosen, so nothing can be sent. Without
  // this the dialog offered an empty question and a dead button.
  const hasReasons = reasons.length > 0
  const canSubmit = hasReasons && reason !== '' && (!needsDetails || details.trim() !== '')

  const handleSubmit = async () => {
    if (!target || !canSubmit) return

    try {
      const response = await report({
        details: details.trim() || undefined,
        reason,
        target_id: target.id,
        target_type: target.type
      })

      // The server says whether this report was the one that took the content
      // out of public view. Saying so is the difference between a reporter
      // understanding what they just did and watching a topic vanish under them
      // with only a thank-you to go on.
      notificationApi?.success({
        description: response?.data?.hidden
          ? __('It is now hidden from the forum until a moderator has reviewed it.')
          : undefined,
        message: response?.data?.message ?? __('Thank you. A moderator will look at this.')
      })
      close()
    } catch (error) {
      // The server writes its refusals for the reporter to read — "you have
      // already reported this", "please say what is wrong with it" — so they
      // are shown as-is rather than replaced with a generic failure.
      notificationApi?.error({
        message:
          (error as { message?: string })?.message ??
          __('Your report could not be sent. Please try again.')
      })
    }
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isReporting}
      okButtonProps={{ danger: true, disabled: !canSubmit }}
      okText={__('Send report')}
      onCancel={close}
      onOk={handleSubmit}
      open={isOpen}
      title={__('Report this to a moderator')}
    >
      {target?.excerpt && (
        <Paragraph
          className="bc-mb-3 bc-rounded bc-bg-surface-sunken bc-p-2 bc-text-sm"
          type="secondary"
        >
          {plain(target.excerpt).slice(0, 240)}
        </Paragraph>
      )}

      {(isReasonsError || (!isReasonsFetching && !hasReasons)) && (
        <Alert
          description={__('The list of reasons could not be loaded, so this cannot be sent right now.')}
          message={__('Something went wrong')}
          showIcon
          type="error"
        />
      )}

      {hasReasons && <Text className="bc-mb-2 bc-block">{__('What is wrong with it?')}</Text>}

      <Radio.Group
        disabled={isReasonsFetching}
        onChange={event => setReason(event.target.value)}
        value={reason}
      >
        <Space direction="vertical">
          {reasons.map(option => (
            <Radio key={option.value} value={option.value}>
              {option.label}
            </Radio>
          ))}
        </Space>
      </Radio.Group>

      {needsDetails && (
        <Input.TextArea
          className="bc-mt-3"
          maxLength={DETAILS_LIMIT}
          onChange={event => setDetails(event.target.value)}
          placeholder={__('Please say what is wrong with it.')}
          rows={3}
          showCount
          value={details}
        />
      )}
    </Modal>
  )
}
