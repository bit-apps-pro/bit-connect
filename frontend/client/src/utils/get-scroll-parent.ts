/** Nearest scrollable ancestor of `node` (by overflow style), or undefined (viewport). */
export default function getScrollParent(node: HTMLElement | null): HTMLElement | undefined {
  let element = node?.parentElement
  while (element) {
    const { overflowY } = getComputedStyle(element)
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return element
    }
    element = element.parentElement ?? undefined
  }
  return undefined
}
