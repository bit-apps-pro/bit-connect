import { lazy, Suspense } from 'react'

import { type QuillEditorProps } from './QuillEditor'

// Quill and its blots are the heaviest thing the portal ships, and most visits
// only read. Loading the editor here, on first render of a composer, keeps it
// out of the bundle every page downloads up front.
const QuillEditor = lazy(() => import('./QuillEditor'))

/**
 * Holds the editor's footprint while its chunk arrives — the same rounded,
 * bordered box at the editor's minimum height — so the form below does not
 * jump when it swaps in.
 */
function EditorPlaceholder({ className }: Pick<QuillEditorProps, 'className'>) {
  return (
    <div
      aria-busy="true"
      className={`bc-min-h-[170px] bc-rounded-lg bc-border bc-border-solid bc-border-line ${className || ''}`}
    />
  )
}

export default function LazyQuillEditor(props: QuillEditorProps) {
  return (
    <Suspense fallback={<EditorPlaceholder className={props.className} />}>
      <QuillEditor {...props} />
    </Suspense>
  )
}
