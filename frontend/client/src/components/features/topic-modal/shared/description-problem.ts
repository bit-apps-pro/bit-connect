import { __, sprintf } from '@common/helpers/i18nWrap'
import { countCharacters } from '@components/quilTextEditor/quill-validation'

export interface DescriptionAllowance {
  /** The editor offers a picture control. */
  canAddImage: boolean
  /** The editor offers a video control. */
  canAddVideo: boolean
  /** Most characters the text may hold. */
  maxLength: number
}

/**
 * Why the topic description cannot be posted yet, or undefined when it can.
 *
 * A picture or a video on its own is a description — a screenshot or a screen
 * recording often says more than the paragraph describing it. A file still
 * uploading is not: posting then would save the placeholder and lose the file,
 * and the modal's own wait only covers the attachments under the editor.
 *
 * The empty-description message names only what this editor offers, so a forum
 * that takes no pictures is not asked for one.
 */
export const descriptionProblem = (
  html: string,
  { canAddImage, canAddVideo, maxLength }: DescriptionAllowance
): string | undefined => {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // The editor's upload placeholder (quill-image-loading-blot.ts), which the
  // WordPress formatter keeps because it carries attributes of its own.
  if (doc.querySelector('[data-loading-id]')) {
    return __('Please wait for the upload to finish')
  }

  const characters = countCharacters(html)

  if (characters === 0 && !doc.querySelector('img, video')) {
    if (canAddImage && canAddVideo) return __('Please enter a description, or add an image or a video')
    if (canAddImage) return __('Please enter a description or add an image')
    if (canAddVideo) return __('Please enter a description or add a video')
    return __('Please enter a description')
  }

  if (characters > maxLength) {
    // translators: %s is the most characters a topic description may hold.
    return sprintf(__('Description cannot exceed %s characters'), maxLength.toLocaleString())
  }

  return undefined
}
