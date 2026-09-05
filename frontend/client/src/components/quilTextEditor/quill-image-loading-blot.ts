/**
 * Inline embed blot that renders a spinner placeholder while an image uploads.
 * Replaced by the real image blot once the upload URL is available.
 * Registered as 'image-loading' embed so QuillEditor can insert/delete it.
 */

import Quill from 'quill'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EmbedBase = Quill.import('blots/embed') as any

class ImageLoadingBlot extends EmbedBase {
  static blotName = 'image-loading'
  static className = 'ql-image-loading'
  static tagName = 'span'

  static create(id: string): HTMLElement {
    const node = super.create(id) as HTMLElement
    node.dataset.loadingId = id
    node.setAttribute('contenteditable', 'false')
    node.setAttribute('aria-label', 'Uploading image…')
    // Announce progress to assistive tech as it changes, and give the CSS a
    // value to render beside the spinner.
    node.setAttribute('role', 'progressbar')
    node.setAttribute('aria-valuemin', '0')
    node.setAttribute('aria-valuemax', '100')
    return node
  }

  static value(node: HTMLElement): string {
    return node.dataset.loadingId ?? ''
  }
}

/**
 * Updates the placeholder for an in-flight upload. The blot is plain DOM once
 * inserted, so the percentage is written as a data attribute and drawn by CSS
 * rather than re-rendering the embed (which would disturb the selection).
 */
export function setImageLoadingProgress(root: HTMLElement, id: string, percent: number): void {
  const node = root.querySelector<HTMLElement>(`[data-loading-id="${CSS.escape(id)}"]`)
  if (!node) return
  node.dataset.progress = String(percent)
  node.setAttribute('aria-valuenow', String(percent))
  // Drives the width of the fill along the bottom edge (see QuillEditor.module.css).
  node.style.setProperty('--ql-upload-progress', String(percent))
}

Quill.register(ImageLoadingBlot)
