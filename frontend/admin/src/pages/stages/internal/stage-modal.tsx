import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import Input from '@components/utilities/Input/Input'
import TextArea from '@components/utilities/Textarea/TextArea'
import IconPickerField, { iconDarkHint, iconSizeHint } from '@utilities/icon-picker-field'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import { Alert, Form, type FormInstance, Modal } from 'antd'
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

  useEffect(() => {
    if (!open) return

    if (stage) {
      form.setFieldsValue({
        description: stage.description,
        icon_dark_id: stage.meta?.icon_dark_id || 0,
        icon_dark_url: stage.meta?.icon_dark_url,
        icon_file_name: stage.iconFileName,
        icon_id: stage.meta?.icon_id || 0,
        icon_url: stage.meta?.icon_url,
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
      // Ensure all icon fields are included even if they're undefined
      const formData: StageFormData = {
        description: values.description,
        icon_dark_id: values.icon_dark_id || 0,
        icon_dark_url: values.icon_dark_url,
        icon_file_name: values.icon_file_name,
        icon_id: values.icon_id || 0,
        icon_url: values.icon_url,
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

        <Form.Item label={__('Description')} name="description">
          <TextArea placeholder={__('Enter stage description (optional)')} rows={3} />
        </Form.Item>

        <IconPickerField
          baseName="icon"
          extra={iconSizeHint()}
          form={form}
          label={__('Icon (light mode)')}
          previewAlt={__('Stage icon')}
        />

        <IconPickerField
          baseName="icon_dark"
          extra={iconDarkHint()}
          form={form}
          label={__('Icon (dark mode)')}
          previewAlt={__('Stage icon for dark mode')}
        />
      </Form>
      {errorMessage && <Alert message={errorMessage} type="error" />}
    </Modal>
  )
}
