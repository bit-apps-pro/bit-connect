import { afterEach, describe, expect, it } from 'vitest'

import getScrollParent from './get-scroll-parent'

// Used to scroll a comment into view. Picking the wrong ancestor scrolls
// something that is not moving, and the comment the reader was sent to never
// appears — with nothing in the console to say why.
/** A chain of nested divs with the given overflow styles, innermost last. */
function build(overflows: (string | undefined)[]): HTMLElement {
  let parent = document.body

  for (const overflow of overflows) {
    const element = document.createElement('div')

    if (overflow !== undefined) element.style.overflowY = overflow

    parent.append(element)
    parent = element
  }

  const leaf = document.createElement('span')
  parent.append(leaf)

  return leaf as unknown as HTMLElement
}

describe('getScrollParent', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('finds the nearest scrollable ancestor', () => {
    const leaf = build(['auto', undefined])

    expect(getScrollParent(leaf)).toBe(document.body.firstElementChild)
  })

  it('accepts a scroll container as readily as an auto one', () => {
    const leaf = build(['scroll'])

    expect(getScrollParent(leaf)?.style.overflowY).toBe('scroll')
  })

  it('stops at the nearest one rather than the outermost', () => {
    const leaf = build(['auto', 'scroll'])

    expect(getScrollParent(leaf)?.style.overflowY).toBe('scroll')
  })

  it('answers undefined when nothing between the node and the page scrolls', () => {
    expect(getScrollParent(build([undefined, undefined]))).toBeUndefined()
  })

  // The caller then scrolls the viewport, which is the right fallback.
  it('answers undefined for a node that is not in the document', () => {
    expect(getScrollParent(document.createElement('div'))).toBeUndefined()
  })

  it('answers undefined rather than throwing when given nothing', () => {
    // eslint-disable-next-line unicorn/no-null -- the ref this reads is null before it is attached
    expect(getScrollParent(null)).toBeUndefined()
  })
})
