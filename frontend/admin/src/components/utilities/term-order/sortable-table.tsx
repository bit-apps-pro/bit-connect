import { closestCenter, DndContext, type DragEndEvent, type SensorDescriptor } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { type ReactNode } from 'react'

interface SortableTableProps {
  children: ReactNode
  items: number[]
  onDragEnd: (event: DragEndEvent) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sensors: SensorDescriptor<any>[]
}

/**
 * Wraps an antd `<Table>` so its rows can be dragged.
 *
 * The table itself needs `components={{ body: { row: SortableRow } }}`,
 * `rowKey="id"` and `pagination={false}` — a row on another page cannot be a
 * drop target, and `SortableRow` reads the term id from `data-row-key`.
 */
export default function SortableTable({ children, items, onDragEnd, sensors }: SortableTableProps) {
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd} sensors={sensors}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
