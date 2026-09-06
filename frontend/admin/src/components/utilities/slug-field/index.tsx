import { __ } from '@common/helpers/i18nWrap'
import slugify from '@common/helpers/slugify'
import { Form, type FormInstance, Input } from 'antd'
import { useEffect, useState } from 'react'

/**
 * Keeps a `slug` form field in step with a `name` field.
 *
 * The slug tracks the name as it is typed, until the slug is edited by hand.
 * Driven from the fields' own onChange rather than a watcher, so merely opening
 * a modal cannot rewrite a slug that was deliberately set to something other
 * than the name.
 *
 * @param open whether the containing modal is open; resets the hand-edited flag
 */
export function useSlugSync(form: FormInstance, open: boolean) {
  const [isSlugEdited, setIsSlugEdited] = useState(false)

  useEffect(() => {
    if (open) setIsSlugEdited(false)
  }, [open])

  return {
    onNameChange: (value: string) => {
      if (isSlugEdited) return
      form.setFieldValue('slug', slugify(value))
    },
    onSlugChange: () => setIsSlugEdited(true)
  }
}

interface SlugFieldProps {
  isEditMode?: boolean
  onChange: () => void
}

/** The `slug` form item. Pair it with `useSlugSync`. */
export default function SlugField({ isEditMode, onChange }: SlugFieldProps) {
  return (
    <Form.Item
      extra={
        isEditMode
          ? __('Used in portal URLs. Changing it breaks links that already point here.')
          : __('Used in portal URLs. Leave blank to build one from the name.')
      }
      label={__('Slug')}
      name="slug"
    >
      <Input onChange={onChange} placeholder={__('term-slug')} />
    </Form.Item>
  )
}
