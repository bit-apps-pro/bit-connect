interface OrderableTerm {
  id: number
  meta?: { order?: number }
}

/**
 * Terms in the order an admin arranged them by dragging.
 *
 * WordPress cannot sort terms by meta, so the core terms endpoint returns them
 * alphabetically and the position is applied here instead. A term with no
 * position has never been dragged — a fresh install, or one created after the
 * last reorder — and sorts after the ones that have, oldest first.
 *
 * Mirrors `TermOrderService::sort()` on the backend; change both together.
 *
 * Returns a new array: callers mirror the result into local state to reorder it
 * optimistically, and sorting in place would mutate the query cache.
 */
export default function sortByOrder<T extends OrderableTerm>(terms: T[]): T[] {
  return [...terms].sort((first, second) => {
    const firstPosition = first.meta?.order ?? Number.MAX_SAFE_INTEGER
    const secondPosition = second.meta?.order ?? Number.MAX_SAFE_INTEGER

    if (firstPosition === secondPosition) return first.id - second.id

    return firstPosition - secondPosition
  })
}
