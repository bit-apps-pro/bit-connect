import { type RefObject } from 'react'

import useEventListener from './useEventListener'

type Handler = (event: MouseEvent) => void

function useOnClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: Handler,
  mouseEvent: 'mousedown' | 'mouseup' = 'mousedown'
): void {
  useEventListener(mouseEvent, event => {
    const element = ref?.current

    // Do nothing if clicking ref's element or descendent elements
    if (!element || element.contains(event.target as Node)) {
      return
    }

    handler(event)
  })
}
export default useOnClickOutside
