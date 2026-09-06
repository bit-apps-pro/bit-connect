import { __ } from '@common/helpers/i18nWrap'
import { useWpMediaModal } from '@components/hooks/use-wp-media-modal'
import { Button, Form, type FormInstance, Space, Typography } from 'antd'
import { type ReactNode } from 'react'
import { LuUpload } from 'react-icons/lu'

interface IconPickerFieldProps {
  /**
   * Field-name stem. `icon` drives `icon_url` / `icon_id` / `icon_file_name`;
   * `icon_dark` drives the `_dark` trio. The stem matches the term-meta keys so
   * the save paths can read the form values straight through.
   */
  baseName: string
  extra?: ReactNode
  form: FormInstance
  label: ReactNode
  /** Names the artwork for screen readers, e.g. "Stage icon". */
  previewAlt: string
}

/**
 * Media-library picker for one icon: preview, file name, remove, and upload.
 *
 * Extracted because stages, statuses and topic types each carry a light and a
 * dark icon — six copies of this block otherwise, and it had already drifted
 * between the three (the topic-type copy still labelled its preview "Stage
 * icon").
 */
export default function IconPickerField({
  baseName,
  extra,
  form,
  label,
  previewAlt
}: IconPickerFieldProps) {
  const { openMediaModal } = useWpMediaModal()

  const urlField = `${baseName}_url`
  const idField = `${baseName}_id`
  const fileNameField = `${baseName}_file_name`

  const iconUrl = Form.useWatch(urlField, form)
  const fileName = Form.useWatch(fileNameField, form)

  const handleOpenMediaModal = () => {
    openMediaModal({
      library: { type: 'image' },
      onSelect: attachment => {
        form.setFieldsValue({
          [fileNameField]: attachment.fileName,
          [idField]: attachment.id,
          [urlField]: attachment.url
        })
      }
    })
  }

  const handleRemove = () => {
    form.setFieldsValue({
      [fileNameField]: undefined,
      [idField]: undefined,
      [urlField]: undefined
    })
  }

  return (
    <>
      <Form.Item extra={extra} label={label}>
        <Space className="bc-w-full" direction="vertical" size="middle">
          {iconUrl && (
            <div className="bc-flex bc-items-center bc-gap-3 bc-p-3 bc-bg-surface-raised bc-rounded-lg bc-border bc-border-line">
              <img
                alt={previewAlt}
                className="bc-h-16 bc-w-16 bc-rounded bc-object-cover bc-border bc-border-line-strong"
                onError={event => {
                  const target = event.target as HTMLImageElement
                  target.style.display = 'none'
                }}
                src={iconUrl}
              />
              <div className="bc-flex bc-flex-col bc-flex-1 bc-min-w-0">
                <Typography.Text className="bc-font-medium">{__('Icon Preview')}</Typography.Text>
                {fileName && (
                  <Typography.Text className="bc-text-xs" type="secondary">
                    {fileName}
                  </Typography.Text>
                )}
              </div>
              <Button danger onClick={handleRemove} type="link">
                {__('Remove')}
              </Button>
            </div>
          )}
          <Button icon={<LuUpload />} onClick={handleOpenMediaModal}>
            {iconUrl ? __('Change Icon') : __('Upload Icon')}
          </Button>
        </Space>
      </Form.Item>

      {/* Carry the picked attachment through the form, out of sight. */}
      <Form.Item hidden name={idField}>
        <input type="hidden" />
      </Form.Item>
      <Form.Item hidden name={urlField}>
        <input type="hidden" />
      </Form.Item>
      <Form.Item hidden name={fileNameField}>
        <input type="hidden" />
      </Form.Item>
    </>
  )
}

/**
 * Shared hint copy so the three forms cannot drift apart again. Functions, not
 * constants: `__()` reads a global that is not guaranteed to be populated when
 * this module is first evaluated, so the lookup has to happen at render time.
 */
export const iconSizeHint = () =>
  __(
    'Recommended size: 64x64 to 512x512 pixels (square). Max file size: 2MB. Supported formats: PNG, JPG, SVG.'
  )

export const iconDarkHint = () =>
  __(
    'Optional. Shown when the portal is viewed in dark mode — upload a lighter version here if your icon is dark. Falls back to the light-mode icon when empty.'
  )
