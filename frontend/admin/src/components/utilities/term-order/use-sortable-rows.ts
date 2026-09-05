import { type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { type QueryKey } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import useReorderTerms from './use-reorder-terms'

/**
 * Drag-to-reorder state for a term table.
 *
 * The table renders from `rows` rather than straight from the query, so a drag
 * lands instantly instead of waiting on the round trip. `rows` resyncs whenever
 * the query data changes, which is also how a rejected reorder gets undone.
 *
 * The query hook feeding `terms` must return a referentially stable array while
 * the data is unchanged — memoise its `select` — or every render would resync
 * and undo the drag.
 *
 * @param terms    the current list, already in stored order
 * @param taxonomy the taxonomy slug, e.g. `bit-connect-stages`
 * @param listKey  query key of the list to refresh once the order is stored
 */
export default function useSortableRows<T extends { id: number }>(
  terms: T[],
  taxonomy: string,
  listKey: QueryKey
) {
  const { reorderTerms } = useReorderTerms(taxonomy, listKey)

  const [rows, setRows] = useState<T[]>(terms)
  useEffect(() => {
    setRows(terms)
  }, [terms])

  // A drag starts from the grip only, so the pointer sensor needs no activation
  // distance; the keyboard sensor makes the grip reorder with the arrow keys.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const from = rows.findIndex(term => term.id === active.id)
    const to = rows.findIndex(term => term.id === over.id)
    if (from === -1 || to === -1) return

    const reordered = arrayMove(rows, from, to)
    setRows(reordered)
    reorderTerms(reordered.map(term => term.id)).catch(() => {
      // Reported by the mutation, and the refetch it triggers restores the
      // server's order.
    })
  }

  return { handleDragEnd, rows, sensors }
}
