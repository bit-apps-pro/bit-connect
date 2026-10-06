import { __, sprintf } from '@common/helpers/i18nWrap'
import useRouteTab from '@common/hooks/use-route-tab'
import PageTabs from '@utilities/page-tabs'
import { Button, Input, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { LuClock, LuPlus, LuSearch, LuTags } from 'react-icons/lu'

import useTags from './data/use-tags'
import { useTagStoreActions } from './state/use-tag-store'
import TagCreateModal from './ui/tag-create-modal'
import TagEditModal from './ui/tag-edit-modal'
import TagsTable, { type TagsView } from './ui/tags-table'

const { Title } = Typography

const TAB_KEYS: readonly TagsView[] = ['all', 'pending']

export default function Tags() {
  const { setIsCreateModalOpen } = useTagStoreActions()
  const [search, setSearch] = useState('')
  // In the address, so the pending queue can be linked to and survives a refresh.
  const { activeTab: view, setActiveTab: setView } = useRouteTab('/tags', TAB_KEYS)
  const { tags } = useTags()
  const pendingCount = useMemo(() => tags?.filter(tag => tag.pending).length ?? 0, [tags])

  // Two views rather than a status column: what needs an admin's decision is
  // the question this screen gets opened for, and a count on the tab answers
  // it before anything is read.
  const tabs = useMemo(
    () => [
      { icon: <LuTags size={16} />, key: 'all', label: __('All tags') },
      {
        icon: <LuClock size={16} />,
        key: 'pending',
        // translators: %s: how many tags await review.
        label: pendingCount > 0 ? sprintf(__('Pending (%s)'), String(pendingCount)) : __('Pending')
      }
    ],
    [pendingCount]
  )

  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
        <div className="bc-min-w-0">
          <Title className="bc-mb-0" level={3}>
            {__('Tags')}
          </Title>
        </div>
        <Button icon={<LuPlus />} onClick={() => setIsCreateModalOpen(true)} type="primary">
          {__('Create Tag')}
        </Button>
      </div>

      <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
        {/* Narrows the table as the admin types. The whole list is already
            loaded, so this is a filter over it rather than a query, and it
            matches the description too — a tag is often found by what it is
            for rather than what it is called. */}
        <Input
          allowClear
          className="bc-max-w-xs"
          onChange={event => setSearch(event.target.value.trim())}
          placeholder={__('Search tags…')}
          prefix={<LuSearch aria-hidden className="bc-text-ink-subtle" />}
          value={search}
        />
        <PageTabs onChange={setView} tabs={tabs} value={view} />
      </div>

      {/* The layout's ground is sunken, so the table sits on its own raised
          card, like the General screen's sections. */}
      <div className="bc-overflow-x-auto bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
        <TagsTable search={search} view={view} />
      </div>
      <TagCreateModal />
      <TagEditModal />
    </div>
  )
}
