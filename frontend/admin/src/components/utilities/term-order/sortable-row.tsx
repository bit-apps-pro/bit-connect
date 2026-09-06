import { __ } from '@common/helpers/i18nWrap'
import { type DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from 'antd'
import { createContext, type CSSProperties, type HTMLAttributes, useContext, useMemo } from 'react'
import { LuGripVertical } from 'react-icons/lu'

interface RowContextValue {
  listeners?: DraggableSyntheticListeners
  setActivatorNodeRef?: (element: HTMLElement | null) => void
}

/**
 * antd renders cells through the column's `render`, which sits outside the
 * `<tr>` component — so the drag activator cannot be wired up by props and is
 * passed down through context instead.
 */
const RowContext = createContext<RowContextValue>({})

/** The grip that starts a drag. Place it in a column's `render`. */
export function DragHandle() {
  const { listeners, setActivatorNodeRef } = useContext(RowContext)

  return (
    <Button
      aria-label={__('Reorder')}
      className="bc-cursor-grab active:bc-cursor-grabbing"
      icon={<LuGripVertical size={16} />}
      ref={setActivatorNodeRef}
      size="small"
      type="text"
      {...listeners}
    />
  )
}

interface SortableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  'data-row-key'?: number
}

/** A table row that can be dragged by its `DragHandle`. */
export default function SortableRow(props: SortableRowProps) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform, transition } =
    useSortable({ id: props['data-row-key'] ?? '' })

  // Rows only ever move up and down, so the horizontal component of the
  // transform is dropped rather than pulling in a modifiers package for it.
  const dragTransform = transform ? { ...transform, scaleX: 1, x: 0 } : undefined

  const style: CSSProperties = {
    ...props.style,
    transform: dragTransform && CSS.Transform.toString(dragTransform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 1 } : {})
  }

  const contextValue = useMemo(
    () => ({ listeners, setActivatorNodeRef }),
    [listeners, setActivatorNodeRef]
  )

  return (
    <RowContext.Provider value={contextValue}>
      <tr {...props} {...attributes} ref={setNodeRef} style={style} />
    </RowContext.Provider>
  )
}
