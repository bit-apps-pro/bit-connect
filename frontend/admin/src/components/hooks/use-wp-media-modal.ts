import { __ } from '@common/helpers/i18nWrap'
import { useCallback } from 'react'

interface WpMediaAttachment {
  [key: string]: unknown
  filename?: string
  filesizeHumanReadable?: string
  filesizeInBytes?: number
  id: number
  url: string
}

interface UseWpMediaModalOptions {
  library?: {
    type?: string
  }
  multiple?: boolean
  onSelect: (attachment: { fileName?: string; fileSize?: number; id: number; url: string }) => void
}

export function useWpMediaModal() {
  const openMediaModal = useCallback((options: UseWpMediaModalOptions) => {
    if (typeof window === 'undefined' || !window.wp?.media) {
      console.warn('WordPress media library is not available')
      return
    }

    const { library, multiple = false, onSelect } = options

    // Create media frame
    const frame = window.wp.media({
      button: {
        text: __('Select Icon')
      },
      library: {
        type: library?.type || 'image'
      },
      multiple,
      title: __('Select Icon')
    })

    // Handle selection
    frame.on('select', () => {
      const attachment = frame.state().get('selection').first().toJSON() as WpMediaAttachment
      onSelect({
        fileName: attachment.filename || attachment.url?.split('/').pop() || undefined,
        fileSize: attachment.filesizeInBytes,
        id: attachment.id,
        url: attachment.url
      })
    })

    // Open the modal
    frame.open()
  }, [])

  return { openMediaModal }
}
