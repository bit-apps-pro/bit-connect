import { __, sprintf } from '@common/helpers/i18nWrap'
import { Form, Modal, Select, Typography } from 'antd'
import { useEffect } from 'react'

import useMergeTag from '../data/use-merge-tag'
import { type Tag } from '../shared/types'

interface TagMergeModalProps {
  onClose: () => void
  /** The tag being merged away, or undefined while the modal is closed. */
  source: Tag | undefined
  tags: Tag[]
}

/**
 * Pick the tag a tag is folded into.
 *
 * The merge is a delete with the topics saved first, so the modal says what
 * will happen to them and to the tag's followers before asking for the click.
 * Only other tags are offered: merging into itself is a no-op the server
 * refuses, and a menu that listed it would invite the one wrong answer.
 */
export default function TagMergeModal({ onClose, source, tags }: TagMergeModalProps) {
  const [form] = Form.useForm<{ into: number }>()
  const { isMergingTag, mergeTag } = useMergeTag()
  const open = source !== undefined

  useEffect(() => {
    if (!open) form.resetFields()
  }, [open, form])

  const options = tags
    .filter(tag => tag.id !== source?.id)
    .map(tag => ({
      label: sprintf(
        // translators: 1: tag name, 2: number of topics
        __('%1$s (%2$s topics)'),
        tag.name,
        String(tag.count)
      ),
      value: tag.id
    }))

  const handleOk = async () => {
    if (!source) return

    try {
      const { into } = await form.validateFields()
      await mergeTag({ from: source.id, into })
      onClose()
    } catch (error) {
      // Validation, or a merge the hook has already reported.
      console.error('Failed to merge tag:', error)
    }
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isMergingTag}
      forceRender
      okButtonProps={{ danger: true, disabled: isMergingTag || options.length === 0 }}
      okText={__('Merge')}
      onCancel={onClose}
      onOk={handleOk}
      open={open}
      title={source ? sprintf(__('Merge “%s” into…'), source.name) : __('Merge tag')}
    >
      <Typography.Paragraph>
        {source &&
          sprintf(
            // translators: 1: number of topics, 2: tag name
            __(
              'The %1$s topics tagged “%2$s” will be filed under the tag you choose, anyone following it will follow that tag instead, and “%2$s” will be deleted.'
            ),
            String(source.count),
            source.name
          )}
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item
          label={__('Merge into')}
          name="into"
          rules={[{ message: __('Choose the tag to merge into'), required: true }]}
        >
          <Select
            optionFilterProp="label"
            options={options}
            placeholder={options.length === 0 ? __('There is no other tag to merge into') : __('Choose a tag')}
            showSearch
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
