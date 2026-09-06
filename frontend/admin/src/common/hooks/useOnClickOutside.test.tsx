import { fireEvent, render } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import useEventListener from './useEventListener'
import useOnClickOutside from './useOnClickOutside'

// Every popover, dropdown and menu closes through this. Two failures matter and
// both are ordinary use: a click inside the panel that closes it (so nothing
// inside a dropdown can be clicked), and a listener that outlives the panel
// (so a later click calls a handler belonging to a component that is gone).
describe('useOnClickOutside', () => {
  function Panel({
    handler,
    mouseEvent
  }: {
    handler: (event: MouseEvent) => void
    mouseEvent?: 'mousedown' | 'mouseup'
  }) {
    const ref = useRef<HTMLDivElement>(null)

    useOnClickOutside(ref, handler, mouseEvent)

    return (
      <div>
        <div data-testid="panel" ref={ref}>
          <button type="button">inside</button>
        </div>
        <button type="button">outside</button>
      </div>
    )
  }

  it('fires for a click anywhere else on the page', () => {
    const handler = vi.fn()
    const { getByText } = render(<Panel handler={handler} />)

    fireEvent.mouseDown(getByText('outside'))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not fire for a click on the panel itself', () => {
    const handler = vi.fn()
    const { getByTestId } = render(<Panel handler={handler} />)

    fireEvent.mouseDown(getByTestId('panel'))

    expect(handler).not.toHaveBeenCalled()
  })

  // A dropdown whose own options close it is a dropdown nothing can be picked
  // from.
  it('does not fire for a click on something inside the panel', () => {
    const handler = vi.fn()
    const { getByText } = render(<Panel handler={handler} />)

    fireEvent.mouseDown(getByText('inside'))

    expect(handler).not.toHaveBeenCalled()
  })

  it('can be told to listen for the release instead of the press', () => {
    const handler = vi.fn()
    const { getByText } = render(<Panel handler={handler} mouseEvent="mouseup" />)

    fireEvent.mouseDown(getByText('outside'))
    expect(handler).not.toHaveBeenCalled()

    fireEvent.mouseUp(getByText('outside'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('stops listening once the panel is gone', () => {
    const handler = vi.fn()
    const { unmount } = render(<Panel handler={handler} />)

    unmount()
    fireEvent.mouseDown(document.body)

    expect(handler).not.toHaveBeenCalled()
  })
})

describe('useEventListener', () => {
  function Listener({ onResize }: { onResize: () => void }) {
    useEventListener('resize', onResize)

    return <div>listening</div>
  }

  it('listens on the window by default', () => {
    const onResize = vi.fn()
    render(<Listener onResize={onResize} />)

    fireEvent(window, new Event('resize'))

    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('removes its listener on unmount', () => {
    const onResize = vi.fn()
    const { unmount } = render(<Listener onResize={onResize} />)

    unmount()
    fireEvent(window, new Event('resize'))

    expect(onResize).not.toHaveBeenCalled()
  })

  // The handler is kept in a ref so a new one every render does not detach and
  // reattach the listener — while still being the one that gets called.
  it('calls the newest handler without rebinding the listener', () => {
    const first = vi.fn()
    const second = vi.fn()

    const { rerender } = render(<Listener onResize={first} />)
    rerender(<Listener onResize={second} />)

    fireEvent(window, new Event('resize'))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('listens on an element when given one', () => {
    const onClick = vi.fn()

    function Target() {
      const ref = useRef<HTMLDivElement>(null)

      useEventListener('click', onClick, ref)

      return <div data-testid="target" ref={ref} />
    }

    const { getByTestId } = render(<Target />)

    fireEvent.click(getByTestId('target'))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
