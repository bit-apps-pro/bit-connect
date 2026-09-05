import { __ } from '@common/helpers/i18nWrap'
import Input from '@utilities/Input'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import TextArea from '@utilities/Textarea'
import { type FormInstance } from 'antd'
import { Form } from 'antd'

interface TagFormProps {
  form: FormInstance
  isEditMode?: boolean
  open: boolean
}

export default function TagForm({ form, isEditMode, open }: TagFormProps) {
  const { onNameChange, onSlugChange } = useSlugSync(form, open)

  return (
    <div>
      <Form form={form} layout="vertical">
        <Form.Item
          label={__('Tag Name')}
          name="name"
          rules={[{ message: __('Tag name is required'), required: true }]}
        >
          <Input
            onChange={event => onNameChange(event.target.value)}
            placeholder={__('Enter tag name')}
          />
        </Form.Item>
        <SlugField isEditMode={isEditMode} onChange={onSlugChange} />
        <Form.Item label={__('Description')} name="description">
          <TextArea placeholder={__('Enter description')} rows={4} />
        </Form.Item>
      </Form>
    </div>
  )
}
