import { __ } from '@common/helpers/i18nWrap'
import { useWpMediaModal } from '@components/hooks/use-wp-media-modal'
import { Button, Typography } from 'antd'
import { useCallback } from 'react'
import { LuImagePlus, LuX } from 'react-icons/lu'

const { Text } = Typography

interface ImageFieldProps {
  /** What the image is, for anyone reading the page with a screen reader. */
  alt: string
  disabled?: boolean
  onChange: (url: string) => void
  value: string
}

/**
 * Pick an image from the WordPress media library, and see the one you picked.
 *
 * A bare "Upload" button says nothing about whether an image is already set, so
 * the chosen file is shown at the size it will be used, with the way to remove
 * it on the image itself rather than in a separate row.
 */
export default function ImageField({ alt, disabled = false, onChange, value }: ImageFieldProps) {
  const { openMediaModal } = useWpMediaModal()

  const handlePick = useCallback(() => {
    openMediaModal({ library: { type: 'image' }, onSelect: ({ url }) => onChange(url) })
  }, [openMediaModal, onChange])

  if (!value) {
    return (
      <button
        className="bc-flex bc-w-full bc-cursor-pointer bc-flex-col bc-items-center bc-justify-center bc-gap-1 bc-rounded-md bc-border bc-border-dashed bc-border-line-strong bc-bg-surface-sunken bc-px-4 bc-py-6 bc-text-ink-muted hover:bc-border-primary hover:bc-text-primary disabled:bc-cursor-not-allowed disabled:bc-opacity-60"
        disabled={disabled}
        onClick={handlePick}
        type="button"
      >
        <LuImagePlus aria-hidden size={20} />
        <span className="bc-text-sm">{__('Choose an image')}</span>
      </button>
    )
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-2">
      <div className="bc-relative bc-flex bc-items-center bc-justify-center bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface-sunken bc-p-3">
        <img alt={alt} className="bc-h-12 bc-max-w-full bc-object-contain" src={value} />
        <Button
          aria-label={__('Remove image')}
          className="bc-absolute bc-right-1 bc-top-1"
          disabled={disabled}
          icon={<LuX size={14} />}
          onClick={() => onChange('')}
          size="small"
          type="text"
        />
      </div>
      <div className="bc-flex bc-items-center bc-justify-between bc-gap-2">
        <Button disabled={disabled} onClick={handlePick} size="small">
          {__('Replace')}
        </Button>
        <Text className="bc-truncate bc-text-xs" title={value} type="secondary">
          {value.split('/').pop()}
        </Text>
      </div>
    </div>
  )
}
