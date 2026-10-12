import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import Input from '@components/utilities/Input/Input'
import TextArea from '@components/utilities/Textarea/TextArea'
import ChipPreview from '@utilities/chip-preview'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import { Alert, ColorPicker, Form, type FormInstance, Modal } from 'antd'
import { useEffect } from 'react'

import { type Stage, type StageFormData } from '../shared/types'

interface StageModalProps {
  errorMessage?: string
  form: FormInstance<StageFormData>
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (data: StageFormData) => Promise<void>
  open: boolean
  stage?: Stage
}

export default function StageModal({
  errorMessage,
  form,
  isSubmitting,
  onCancel,
  onSubmit,
  open,
  stage
}: StageModalProps) {
  const isEditMode = !!stage

  const { onNameChange, onSlugChange } = useSlugSync(form, open)
  const color = Form.useWatch('color', form)
  const name = Form.useWatch('name', form)

  useEffect(() => {
    if (!open) return

    if (stage) {
      form.setFieldsValue({
        color: stage.meta?.bit_connect_color,
        description: stage.description,
        name: stage.name,
        slug: stage.slug
      })
    } else {
      form.resetFields()
    }
  }, [open, stage, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const formData: StageFormData = {
        color: values.color,
        description: values.description,
        name: values.name,
        // Sanitised again server-side; blank lets WordPress derive it.
        slug: slugify(values.slug ?? '')
      }
      await onSubmit(formData)
    } catch (error) {
      // Form validation error
      console.error('Form validation error:', error)
    }
  }

  return (
    <Modal
      cancelText={__('Cancel')}
      confirmLoading={isSubmitting}
      destroyOnClose
      okText={__('Save')}
      onCancel={onCancel}
      onOk={handleSubmit}
      open={open}
      title={isEditMode ? __('Edit Stage') : __('Create Stage')}
      width={600}
    >
      <Form className="bc-mt-4" form={form} layout="vertical">
        <Form.Item
          label={__('Stage Name')}
          name="name"
          rules={[{ message: __('Stage name is required'), required: true }]}
        >
          <Input
            onChange={event => onNameChange(event.target.value)}
            placeholder={__('Enter stage name')}
          />
        </Form.Item>

        <SlugField isEditMode={isEditMode} onChange={onSlugChange} />

        <Form.Item
          extra={__('Used for the stage badge on topic cards and its column on the roadmap.')}
          label={__('Color')}
          name="color"
          normalize={value => {
            if (typeof value === 'string') return value
            if (value && typeof value === 'object' && 'toHexString' in value) {
              return value.toHexString()
            }
            return value
          }}
        >
          <ColorPicker allowClear format="hex" showText />
        </Form.Item>
        {/* A form item's own gap below, so the preview does not sit on the
            next field's label. */}
        {color && (
          <div className="bc--mt-4 bc-mb-6">
            <ChipPreview color={color} label={name} />
          </div>
        )}

        <Form.Item label={__('Description')} name="description">
          <TextArea placeholder={__('Enter stage description (optional)')} rows={3} />
        </Form.Item>
      </Form>
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
