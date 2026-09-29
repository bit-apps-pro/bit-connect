import { type ReactNode } from 'react'

export interface TopicColumn<Row> {
  align?: 'left' | 'right'
  /** Width utility, e.g. `bc-w-10`. */
  className?: string
  key: string
  render: (row: Row, index: number) => ReactNode
  title: ReactNode
}

interface TopicTableProps<Row> {
  columns: TopicColumn<Row>[]
  empty: string
  rowKey: (row: Row) => number | string
  rows: Row[]
}

const alignClass = (align?: 'left' | 'right') => (align === 'right' ? 'bc-text-right' : 'bc-text-left')

/**
 * The outer columns line up with the card title's inset. Chosen by index rather
 * than `first:`/`last:` variants, which lose to a plain `bc-px-*` loaded later
 * in another stylesheet — both carry `!important`, so order decides.
 */
const edgePadding = (index: number, count: number) =>
  `${index === 0 ? 'bc-pl-6' : 'bc-pl-3'} ${index === count - 1 ? 'bc-pr-6' : 'bc-pr-3'}`

/**
 * A plain table edge to edge inside a flush card.
 *
 * Not antd's Table: the dashboard needs rows and a header rule, none of the
 * sorting, paging or selection machinery, and antd's own header band and cell
 * padding fight the card's.
 */
export default function TopicTable<Row>({ columns, empty, rowKey, rows }: TopicTableProps<Row>) {
  if (rows.length === 0) {
    return <p className="bc-m-0 bc-px-6 bc-py-8 bc-text-center bc-text-sm bc-text-ink-subtle">{empty}</p>
  }

  return (
    <div className="bc-overflow-x-auto">
      <table className="bc-w-full bc-border-collapse bc-text-sm">
        <thead>
          <tr className="bc-border-0 bc-border-b bc-border-solid bc-border-line">
            {columns.map((column, columnIndex) => (
              <th
                className={`bc-whitespace-nowrap bc-py-3 bc-font-medium bc-text-ink-muted ${edgePadding(columnIndex, columns.length)} ${alignClass(column.align)} ${column.className ?? ''}`}
                key={column.key}
                scope="col"
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              className="bc-border-0 bc-border-b bc-border-solid bc-border-line last:bc-border-b-0 hover:bc-bg-surface-hover"
              key={rowKey(row)}
            >
              {columns.map((column, columnIndex) => (
                <td
                  className={`bc-py-3.5 bc-text-ink ${edgePadding(columnIndex, columns.length)} ${alignClass(column.align)} ${column.className ?? ''}`}
                  key={column.key}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
