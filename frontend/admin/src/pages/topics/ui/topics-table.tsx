import { __, sprintf } from '@common/helpers/i18nWrap'
import { Avatar, Button, Dropdown, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import { type ColumnsType, type TablePaginationConfig } from 'antd/es/table'
import { type SorterResult } from 'antd/es/table/interface'
import { type ReactNode } from 'react'
import { LuEllipsis, LuExternalLink } from 'react-icons/lu'

import { fullDate, timeAgo } from '@/utils/format'

import { type ModerationTopicRow, type TopicAbilities, type TopicAction, type TopicFilters } from '../shared/types'
import TermSelect, { TermLabel, type TermOption } from './term-select'

const { Text } = Typography

interface TopicsTableProps {
  abilities: TopicAbilities
  /** Columns another plugin adds, placed before Locked. */
  addedColumns: ColumnsType<ModerationTopicRow>
  filters: TopicFilters
  isLoading: boolean
  onEdit: (row: ModerationTopicRow, patch: { is_locked?: boolean; stages?: number; statuses?: number }) => void
  onPage: (page: number, perPage: number) => void
  onSelect: (ids: number[]) => void
  onSort: (orderby: TopicFilters['orderby'], order: TopicFilters['order']) => void
  rowActions: (row: ModerationTopicRow) => TopicAction[]
  rows: ModerationTopicRow[]
  selected: number[]
  stages: TermOption[]
  statuses: TermOption[]
  total: number
}

/** How a topic is seen beyond its terms: only the unusual cases are marked. */
function VisibilityTag({ row }: { row: ModerationTopicRow }) {
  if (row.hidden) return <Tag color="orange">{__('Hidden')}</Tag>
  return row.post_status === 'private' ? <Tag>{__('Private')}</Tag> : undefined
}

export default function TopicsTable({
  abilities,
  addedColumns,
  filters,
  isLoading,
  onEdit,
  onPage,
  onSelect,
  onSort,
  rowActions,
  rows,
  selected,
  stages,
  statuses,
  total
}: TopicsTableProps): ReactNode {
  const sortOrder = (column: string) =>
    // eslint-disable-next-line unicorn/no-null -- antd reads undefined as "uncontrolled", null as "not sorted"
    filters.orderby === column ? (filters.order === 'asc' ? 'ascend' : 'descend') : null

  const columns: ColumnsType<ModerationTopicRow> = [
    {
      key: 'title',
      render: (_value, row) => (
        <div className="bc-flex bc-min-w-0 bc-flex-col bc-gap-1">
          <span className="bc-flex bc-min-w-0 bc-items-center bc-gap-2">
            <a className="bc-truncate bc-font-medium" href={row.permalink} rel="noreferrer" target="_blank">
              {row.title || __('(no title)')}
            </a>
            <VisibilityTag row={row} />
          </span>
          <span className="bc-flex bc-flex-wrap bc-items-center bc-gap-x-3 bc-text-xs bc-text-ink-subtle">
            {row.topic_type && <TermLabel color={row.topic_type.color} name={row.topic_type.name} />}
            {Object.values(row.terms).map(term => term && <span key={term.id}>{term.name}</span>)}
          </span>
        </div>
      ),
      sorter: true,
      sortOrder: sortOrder('title'),
      title: __('Post')
    },
    {
      key: 'author',
      render: (_value, row) => (
        <span className="bc-flex bc-min-w-0 bc-items-center bc-gap-2">
          <Avatar size={24} src={row.author.avatar || undefined} />
          <Text className="bc-truncate">{row.author.name || __('Deleted member')}</Text>
        </span>
      ),
      title: __('Author'),
      width: 170
    },
    {
      key: 'status',
      render: (_value, row) => (
        <TermSelect
          className="bc-w-[150px]"
          onChange={id => id && onEdit(row, { statuses: id })}
          placeholder={__('No status')}
          size="small"
          terms={statuses}
          value={row.status?.id}
        />
      ),
      title: __('Status'),
      width: 170
    },
    {
      key: 'stage',
      render: (_value, row) => (
        <TermSelect
          className="bc-w-[150px]"
          onChange={id => id && onEdit(row, { stages: id })}
          placeholder={__('No stage')}
          size="small"
          terms={stages}
          value={row.stage?.id}
        />
      ),
      title: __('Stage'),
      width: 170
    },
    {
      align: 'center',
      dataIndex: 'comments_count',
      key: 'comment_count',
      // Busiest first: nobody sorts by comments to find the quiet ones.
      sortDirections: ['descend', 'ascend'],
      sorter: true,
      sortOrder: sortOrder('comment_count'),
      title: __('Comments'),
      width: 110
    },
    ...addedColumns,
    {
      align: 'center',
      key: 'locked',
      render: (_value, row) => (
        <Tooltip title={abilities.lock ? undefined : __('You cannot lock posts.')}>
          <Switch
            aria-label={__('Locked')}
            checked={row.is_locked}
            disabled={!abilities.lock}
            onChange={checked => onEdit(row, { is_locked: checked })}
            size="small"
          />
        </Tooltip>
      ),
      title: __('Locked'),
      width: 80
    },
    {
      key: 'date',
      render: (_value, row) => (
        <Tooltip title={fullDate(row.created_at)}>
          <Text className="bc-whitespace-nowrap" type="secondary">
            {timeAgo(row.created_at)}
          </Text>
        </Tooltip>
      ),
      sortDirections: ['descend', 'ascend'],
      sorter: true,
      sortOrder: sortOrder('date'),
      title: __('Created'),
      width: 120
    },
    {
      align: 'right',
      key: 'actions',
      render: (_value, row) => {
        const actions = rowActions(row)

        return (
          <span className="bc-flex bc-items-center bc-justify-end bc-gap-1">
            <Tooltip title={__('Open in the portal')}>
              <Button
                aria-label={__('Open in the portal')}
                href={row.permalink}
                icon={<LuExternalLink aria-hidden />}
                size="small"
                target="_blank"
                type="text"
              />
            </Tooltip>
            {actions.length > 0 && (
              <Dropdown
                menu={{
                  items: actions.map(action => ({
                    danger: action.danger,
                    icon: action.icon,
                    key: action.key,
                    label: action.label
                  })),
                  onClick: ({ key }) => actions.find(action => action.key === key)?.run([row.id])
                }}
                trigger={['click']}
              >
                <Button aria-label={__('More actions')} icon={<LuEllipsis aria-hidden />} size="small" type="text" />
              </Dropdown>
            )}
          </span>
        )
      },
      title: <span className="bc-sr-only">{__('Actions')}</span>,
      width: 90
    }
  ]

  return (
    <Table<ModerationTopicRow>
      className="bc-rounded-lg bc-border bc-border-solid bc-border-line"
      columns={columns}
      dataSource={rows}
      loading={isLoading}
      locale={{ emptyText: __('No posts match.') }}
      onChange={(pagination: TablePaginationConfig, _filters, sorter) => {
        const sort = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterResult<ModerationTopicRow>
        const column = String(sort?.columnKey ?? '')
        const orderby = sort?.order && ['comment_count', 'date', 'title'].includes(column) ? column : undefined

        if (orderby !== filters.orderby || (sort?.order === 'ascend' ? 'asc' : 'desc') !== (filters.order ?? 'desc')) {
          onSort(orderby as TopicFilters['orderby'], orderby ? (sort.order === 'ascend' ? 'asc' : 'desc') : undefined)
          return
        }

        onPage(pagination.current ?? 1, pagination.pageSize ?? filters.per_page)
      }}
      pagination={{
        current: filters.page,
        pageSize: filters.per_page,
        showSizeChanger: true,
        showTotal: count => sprintf(__('%d posts'), count),
        total
      }}
      rowKey="id"
      rowSelection={{ onChange: keys => onSelect(keys.map(Number)), selectedRowKeys: selected }}
      scroll={{ x: 1200 }}
      size="middle"
    />
  )
}
