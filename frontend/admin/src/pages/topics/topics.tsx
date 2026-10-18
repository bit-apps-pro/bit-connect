import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import PageTabs, { type PageTab } from '@components/utilities/page-tabs'
import { Alert, Modal, Typography } from 'antd'
import { useCallback, useContext, useMemo, useState } from 'react'
import { LuEye, LuEyeOff, LuList, LuLock, LuLockOpen, LuTrash2 } from 'react-icons/lu'

import useStages from '../stages/data/use-stages'
import useStatuses from '../status/data/use-statuses'
import useTopicTypes from '../topic-types/data/use-topic-types'
import useAddedBulkActions from './data/use-added-bulk-actions'
import useAddedColumns from './data/use-added-columns'
import useAddedViews from './data/use-added-views'
import useModerationTopics from './data/use-moderation-topics'
import { type TopicPatch, useBulkTopicAction, useUpdateTopic } from './data/use-topic-actions'
import useTopicFilters from './data/use-topic-filters'
import bulkSummary from './shared/bulk-summary'
import { type BulkAction, type ModerationTopicRow, type TopicAction, type TopicFilters } from './shared/types'
import BulkActionBar, { type TermAction } from './ui/bulk-action-bar'
import { type TermOption } from './ui/term-select'
import TopicsFilters from './ui/topics-filters'
import TopicsTable from './ui/topics-table'

const { Text, Title } = Typography

const FIRST_PAGE: TopicFilters = { page: 1, per_page: 20 }

/** A term list from the core terms endpoint, as the table's selects take it. */
function asOptions(terms: { id: number; meta?: { bit_connect_color?: string }; name: string }[]): TermOption[] {
  return terms.map(term => ({ color: term.meta?.bit_connect_color, id: term.id, name: term.name }))
}

/**
 * Every topic in one table, for the people who look after them: set a status
 * or a stage, lock, hide or delete — one row at a time or many at once.
 *
 * Defining the statuses and stages themselves stays on their own screens.
 */
export default function Topics() {
  const { notificationApi } = useContext(NotifyContext)
  const [modal, modalHolder] = Modal.useModal()

  const addedViews = useAddedViews()
  const addedBulkActions = useAddedBulkActions()
  const addedColumns = useAddedColumns()
  const [view, setView] = useState('')
  const [filters, setFilters] = useState<TopicFilters>(FIRST_PAGE)
  const [selected, setSelected] = useState<number[]>([])

  const { isTopicsError, isTopicsFetching, topics } = useModerationTopics(filters, view)
  const { abilities, taxonomies } = useTopicFilters()
  const { statuses } = useStatuses()
  const { stages } = useStages()
  const { topicTypes } = useTopicTypes()
  const { updateTopic } = useUpdateTopic()
  const { isBulkRunning, runBulkAction } = useBulkTopicAction()

  const statusOptions = useMemo(() => asOptions(statuses), [statuses])
  const stageOptions = useMemo(() => asOptions(stages), [stages])
  const typeOptions = useMemo(() => asOptions(topicTypes), [topicTypes])
  const currentView = addedViews.find(added => added.value === view)

  // Any filter change returns to page 1 and lets go of the selection: rows
  // picked on a list that is no longer on screen are not what Apply should
  // reach.
  const setFilter = useCallback((patch: Partial<TopicFilters>) => {
    setFilters(previous => ({ ...previous, ...patch, page: 1 }))
    setSelected([])
  }, [])

  const isFiltered = Object.entries(filters).some(
    ([key, value]) =>
      !['order', 'orderby', 'page', 'per_page'].includes(key) &&
      (key === 'terms' ? Object.values(value ?? {}).some(Boolean) : value !== undefined)
  )

  const fail = (error: unknown) =>
    notificationApi?.error({
      message: (error as { message?: string })?.message ?? __('That could not be saved.')
    })

  const bulk = (action: BulkAction, termId?: number) => async (ids: number[]) => {
    try {
      const summary = bulkSummary(await runBulkAction({ action, ids, termId }))
      notificationApi?.[summary.type]({ message: summary.text })
      setSelected([])
    } catch (error) {
      fail(error)
    }
  }

  // The selection is let go once an action has run, whoever supplied it: the
  // rows it named may have left the list.
  const run = (action: TopicAction, ids: number[]) => {
    const go = () => action.run(ids).finally(() => setSelected([]))

    if (!action.confirm) {
      void go()
      return
    }

    void modal.confirm({
      content: action.confirm,
      okButtonProps: { danger: action.danger },
      okText: action.label,
      onOk: go,
      title: action.label
    })
  }

  const hide: TopicAction = {
    confirm: __('Only moderators and the authors can see hidden posts in the portal. You can restore them later.'),
    icon: <LuEyeOff aria-hidden />,
    key: 'hide',
    label: __('Hide'),
    run: bulk('hide')
  }
  const restore: TopicAction = { icon: <LuEye aria-hidden />, key: 'restore', label: __('Restore'), run: bulk('restore') }
  const remove: TopicAction = {
    confirm: __('Delete removes the posts and all their comments. You cannot undo this.'),
    danger: true,
    icon: <LuTrash2 aria-hidden />,
    key: 'delete',
    label: __('Delete'),
    run: bulk('delete')
  }

  const ownBulkActions: TopicAction[] = [
    ...addedBulkActions,
    ...(abilities.lock
      ? [
          { icon: <LuLock aria-hidden />, key: 'lock', label: __('Lock'), run: bulk('lock') },
          { icon: <LuLockOpen aria-hidden />, key: 'unlock', label: __('Unlock'), run: bulk('unlock') }
        ]
      : []),
    hide,
    restore,
    ...(abilities.delete_any ? [remove] : [])
  ]

  const termActions: TermAction[] = currentView?.bulkActions
    ? []
    : [
        { key: 'set_status', label: __('Status'), run: (ids, id) => bulk('set_status', id)(ids), terms: statusOptions },
        { key: 'set_stage', label: __('Stage'), run: (ids, id) => bulk('set_stage', id)(ids), terms: stageOptions }
      ]

  const rowActions = (row: ModerationTopicRow): TopicAction[] =>
    currentView?.rowActions ?? [row.hidden ? restore : hide, ...(abilities.delete_any ? [remove] : [])]

  const edit = (row: ModerationTopicRow, patch: TopicPatch) => {
    updateTopic({ id: row.id, patch }).catch(fail)
  }

  const tabs: PageTab[] = useMemo(
    () => [
      { icon: <LuList aria-hidden className="bc-shrink-0" size={16} />, key: '', label: __('All posts') },
      ...addedViews.map(added => ({
        icon: added.icon ?? <LuList aria-hidden className="bc-shrink-0" size={16} />,
        key: added.value,
        label: added.label
      }))
    ],
    [addedViews]
  )

  const total = topics?.pagination.total ?? 0

  return (
    <div className="bc-p-6">
      {modalHolder}

      <div className="bc-mb-5 bc-flex bc-flex-wrap bc-items-end bc-justify-between bc-gap-4">
        <div className="bc-min-w-0">
          <Title className="bc-mb-1" level={3}>
            {__('Posts')}
          </Title>
          <Text type="secondary">
            {__('Set the status and stage of posts. Lock, hide or delete posts one at a time or many at the same time.')}
          </Text>
        </div>
      </div>

      {addedViews.length > 0 && (
        <div className="bc-mb-4">
          <PageTabs
            onChange={key => {
              setView(key)
              setFilters(previous => ({ ...previous, page: 1 }))
              setSelected([])
            }}
            tabs={tabs}
            value={view}
          />
        </div>
      )}

      <TopicsFilters
        filters={filters}
        isFiltered={isFiltered}
        onChange={setFilter}
        onClear={() => {
          setFilters(previous => ({ ...FIRST_PAGE, per_page: previous.per_page }))
          setSelected([])
        }}
        stages={stageOptions}
        statuses={statusOptions}
        taxonomies={taxonomies}
        topicTypes={typeOptions}
      />

      {isTopicsError && (
        <Alert
          className="bc-mb-4"
          description={__('The posts did not load.')}
          message={__('Something went wrong')}
          showIcon
          type="error"
        />
      )}

      <BulkActionBar
        actions={currentView?.bulkActions ?? ownBulkActions}
        isRunning={isBulkRunning}
        onClear={() => setSelected([])}
        onRun={action => run(action, selected)}
        selected={selected}
        termActions={termActions}
      />

      <TopicsTable
        abilities={abilities}
        addedColumns={addedColumns}
        filters={filters}
        isLoading={isTopicsFetching}
        onEdit={edit}
        onPage={(page, perPage) => {
          setFilters(previous => ({ ...previous, page, per_page: perPage }))
          setSelected([])
        }}
        onSelect={setSelected}
        onSort={(orderby, order) => setFilter({ order, orderby })}
        rowActions={row => rowActions(row).map(action => ({ ...action, run: ids => Promise.resolve(run(action, ids)) }))}
        rows={topics?.data ?? []}
        selected={selected}
        stages={stageOptions}
        statuses={statusOptions}
        total={total}
      />
    </div>
  )
}
