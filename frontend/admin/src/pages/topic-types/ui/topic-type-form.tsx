import { __ } from '@common/helpers/i18nWrap'
import ChipPreview from '@utilities/chip-preview'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import { ColorPicker, type FormInstance, Input, Typography } from 'antd'
import { Form } from 'antd'

interface TopicTypeProps {
  form: FormInstance
  isEditMode?: boolean
  open: boolean
}

export default function TopicTypeForm({ form, isEditMode, open }: TopicTypeProps) {
  const { onNameChange, onSlugChange } = useSlugSync(form, open)
  const color = Form.useWatch('color', form)
  const name = Form.useWatch('name', form)

  return (
    <Form form={form} layout="vertical">
      {/* Required here as on the server: left optional, an empty name went
          through and came back as the raw "Missing parameter(s): name". */}
      <Form.Item
        label={__('Topic Name')}
        name="name"
        rules={[{ message: __('Topic name is required'), required: true, whitespace: true }]}
      >
        <Input onChange={event => onNameChange(event.target.value)} placeholder={__('For example, Question')} />
      </Form.Item>
      <SlugField isEditMode={isEditMode} onChange={onSlugChange} />
      <Form.Item
        label={
          <div>
            {__('Description')} <Typography.Text type="secondary">{__('(For Admin)')}</Typography.Text>
          </div>
        }
        name="description"
      >
        <Input.TextArea placeholder={__('Write Description here')} rows={4} />
      </Form.Item>
      <Form.Item
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
        <ColorPicker format="hex" showText />
      </Form.Item>
      <ChipPreview color={color} label={name} />
    </Form>
  )
}
