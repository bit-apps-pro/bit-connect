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
  /** Controls placed on the toolbar after the link button. */
  toolbar?: ReactNode
  /** A class for the editor's frame. */
  wrapperClassName?: string
}

const NONE: EditorExtras = {}

/**
 * The editor's further tools: none. Its own toolbar is the whole of what this
 * plugin's editor offers.
 */
export default function useEditorExtras(): EditorExtras {
  return NONE
}
