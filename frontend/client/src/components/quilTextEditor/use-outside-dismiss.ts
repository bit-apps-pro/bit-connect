import { type RefObject, useEffect } from 'react'

/**
 * Closes a toolbar popover when the writer presses anywhere outside it or its
 * button — including another toolbar button, so two popovers are never open
 * over each other.
 *
 * Listened for in the capture phase: the toolbar buttons act on mouse down and
 * stop the event there to keep the editor's selection, so a bubbling listener
 * would never hear about them.
 */
export default function useOutsideDismiss(
  open: boolean,
  parts: readonly RefObject<HTMLElement | null>[],
  close: () => void
) {
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (parts.some(part => part.current?.contains(target))) return
      close()
    }
    document.addEventListener('mousedown', onPointerDown, true)
    return () => document.removeEventListener('mousedown', onPointerDown, true)
  }, [open, parts, close])
}
