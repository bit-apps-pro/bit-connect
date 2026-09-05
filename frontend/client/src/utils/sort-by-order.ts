interface OrderableStage {
  id: number
  meta?: { order?: number }
}

/**
 * Stages in the order an admin arranged them on the Stages screen.
 *
 * WordPress cannot sort terms by meta, so the core terms endpoint returns them
 * alphabetically and the position is applied here instead. A stage with no
 * position has never been dragged — a fresh install, or one created after the
 * last reorder — and sorts after the ones that have, oldest first, which is the
 * term-id order the portal showed before ordering existed.
 *
 * Mirrors `StageService::sort()` on the backend; change both together.
 */
export default function sortStages<T extends OrderableStage>(stages: T[]): T[] {
  return [...stages].sort((first, second) => {
    const firstPosition = first.meta?.order ?? Number.MAX_SAFE_INTEGER
    const secondPosition = second.meta?.order ?? Number.MAX_SAFE_INTEGER

    if (firstPosition === secondPosition) return first.id - second.id

    return firstPosition - secondPosition
  })
}
