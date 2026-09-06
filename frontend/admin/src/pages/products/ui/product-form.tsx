import { __ } from '@common/helpers/i18nWrap'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import { type FormInstance, Input } from 'antd'
import { Form } from 'antd'

interface ProductFormProps {
  form: FormInstance
  isEditMode?: boolean
  open: boolean
}

export default function ProductForm({ form, isEditMode, open }: ProductFormProps) {
  const { onNameChange, onSlugChange } = useSlugSync(form, open)

  return (
    <Form form={form} layout="vertical">
      <Form.Item label={__('Product Name')} name="name" rules={[{ required: true }]}>
        <Input onChange={event => onNameChange(event.target.value)} placeholder={__('Product Name')} />
      </Form.Item>
      <SlugField isEditMode={isEditMode} onChange={onSlugChange} />
      <Form.Item label={__('Description')} name="description">
        <Input.TextArea placeholder={__('Description')} />
      </Form.Item>
    </Form>
  )
}
