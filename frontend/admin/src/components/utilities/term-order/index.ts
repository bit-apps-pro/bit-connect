export { default as sortByOrder } from './sort-by-order'
export { DragHandle, default as SortableRow } from './sortable-row'
export { default as SortableTable } from './sortable-table'
export { default as useSortableRows } from './use-sortable-rows'

/**
 * Column definition for the drag grip. Spread it as the first column.
 *
 * Deliberately headerless — the grip labels itself, and an empty msgid is the
 * gettext header entry, so a title must not be translated into existence here.
 */
export const dragColumn = {
  key: 'sort',
  width: 56
}
