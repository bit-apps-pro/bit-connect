import { __ } from '@common/helpers/i18nWrap'
import ChipPreview from '@utilities/chip-preview'
import IconPickerField, { iconDarkHint, iconSizeHint } from '@utilities/icon-picker-field'
import SlugField, { useSlugSync } from '@utilities/slug-field'
import { ColorPicker, type FormInstance, Input, Typography } from 'antd'
import { Form } from 'antd'

interface StatusFormProps {
  form: FormInstance
  isEditMode?: boolean
  open: boolean
}

const { Item } = Form
const { TextArea } = Input
const { Text } = Typography

export default function StatusForm({ form, isEditMode, open }: StatusFormProps) {
  const { onNameChange, onSlugChange } = useSlugSync(form, open)
  const color = Form.useWatch('color', form)
  const name = Form.useWatch('name', form)

  return (
    <Form form={form} layout="vertical">
      <Item label={__('Status Name')} name="name" rules={[{ required: true }]}>
        <Input
          onChange={event => onNameChange(event.target.value)}
          placeholder={__('Write a status here')}
        />
      </Item>
      <SlugField isEditMode={isEditMode} onChange={onSlugChange} />
      <Item
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
      </Item>
      <ChipPreview color={color} label={name} />
      <IconPickerField
        baseName="icon"
        extra={iconSizeHint()}
        form={form}
        label={__('Icon (light mode)')}
        previewAlt={__('Status icon')}
      />
      <IconPickerField
        baseName="icon_dark"
        extra={iconDarkHint()}
        form={form}
        label={__('Icon (dark mode)')}
        previewAlt={__('Status icon for dark mode')}
      />
      <Item
        label={
          <div>
            <Text>{__('Description')}</Text> <Text>{__('(For Admin)')}</Text>
          </div>
        }
        name="description"
      >
        <TextArea placeholder={__('Write a description here')} rows={4} />
      </Item>
    </Form>
  )
}
