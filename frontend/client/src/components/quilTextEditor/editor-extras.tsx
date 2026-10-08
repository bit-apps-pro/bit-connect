import type Quill from 'quill'

import { type ReactNode } from 'react'

/**
 * Further editing tools a plugin may add to the editor, beside its own.
 */
export interface EditorExtras {
  /**
   * Run once the editor holds its first content, and again after every change
   * to its text or selection — before the change is read as HTML.
   */
  onUpdate?: (quill: Quill) => void
  /** Drawn over the editor, inside its frame. */
  overlay?: ReactNode
  /** Controls placed on the toolbar after the image button. */
  toolbar?: ReactNode
  /** A class for the editor's frame. */
  wrapperClassName?: string
}

/** What the editor lends its further tools. */
export interface EditorTools {
  /**
   * Opens the file picker and uploads the chosen video into the text at the
   * caret. Present only where the form takes video uploads.
   */
  pickVideo?: () => void
}

const NONE: EditorExtras = {}

/**
 * The editor's further tools: none. Its own toolbar is the whole of what this
 * plugin's editor offers.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the contract a further tool is handed
export default function useEditorExtras(_tools: EditorTools): EditorExtras {
  return NONE
}
