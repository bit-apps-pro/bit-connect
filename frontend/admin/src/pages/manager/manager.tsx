import { __ } from '@common/helpers/i18nWrap'
import { Avatar, Button, Input, Pagination, Spin, Tag, Typography } from 'antd'
import { useCallback, useState } from 'react'

import useBadgesAdmin from './data/use-badges-admin'
import useResetUserCapabilities from './data/use-reset-user-capabilities'
import useUpdateUserCapabilities from './data/use-update-user-capabilities'
import useUsers from './data/use-users'
import { type ForumCapability } from './shared/types'
import BadgesColumnHeader from './ui/badges-column-header'
import CapabilityPopover from './ui/capability-popover'
import ProfileBadgesModal from './ui/profile-badges-modal'
import RoleCapabilitiesModal from './ui/role-capabilities-modal'
import UserBadgesPopover from './ui/user-badges-popover'

const { Text, Title } = Typography
const { Search } = Input

// ---- Page -------------------------------------------------------------------

export default function Manager() {
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)

  const { isUsersFetching, usersData } = useUsers({ page, perPage: 20, search: debouncedSearch })
  const { isUpdating, updateUserCapabilities } = useUpdateUserCapabilities()
  const { isResetting, resetUserCapabilities } = useResetUserCapabilities()
  // One hook for the whole badge feature, so this page never names the pro-only
  // endpoints and the free build can drop them. See use-badges-admin.ts.
  const { catalog, isSavingBadges, maxPerMember, saveUserBadges } = useBadgesAdmin()

  const handleSearch = useCallback((value: string) => {
    setDebouncedSearch(value)
    setPage(1)
  }, [])

  const handleSaveCaps = useCallback(
    async (userId: number, caps: Record<ForumCapability, boolean>) => {
      await updateUserCapabilities({ capabilities: caps, userId })
    },
    [updateUserCapabilities]
  )

  return (
    <div>
      {/* Page header */}
      <div className="bc-py-6 bc-px-5 bc-flex bc-items-center bc-justify-between">
        <div>
          <Title className="bc-mb-2" level={2}>
            {__('Manage Users')}
          </Title>
          <Text type="secondary">
            {__(
              'View all WordPress users, adjust individual forum capabilities and hand out profile badges. Use Role Capabilities to set defaults per role.'
            )}
          </Text>
        </div>
        <div className="bc-flex bc-shrink-0 bc-gap-2">
          <Button onClick={() => setBadgeModalOpen(true)}>{__('Profile Badges')}</Button>
          <Button onClick={() => setRoleModalOpen(true)} type="primary">
            {__('Role Capabilities')}
          </Button>
        </div>
      </div>

      <div className="bc-px-5">
        {/* Search */}
        <div className="bc-mb-4">
          <Search
            allowClear
            className="bc-max-w-sm"
            onSearch={handleSearch}
            placeholder={__('Search by name, email or username…')}
          />
        </div>

        {/* User list */}
        {isUsersFetching && (
          <div className="bc-flex bc-justify-center bc-py-16">
            <Spin size="large" />
          </div>
        )}
        {!isUsersFetching && !usersData?.users?.length && (
          <div className="bc-py-16 bc-text-center bc-text-ink-subtle bc-text-base">
            {__('No users found.')}
          </div>
        )}
        {!isUsersFetching && Boolean(usersData?.users?.length) && (
          <>
            {/* Table header */}
            <div className="bc-grid bc-grid-cols-[40px_1fr_1fr_140px_160px_100px] bc-gap-3 bc-py-2 bc-px-3 bc-bg-surface-sunken bc-rounded-t bc-border bc-border-solid bc-border-line bc-text-xs bc-font-semibold bc-text-ink-muted bc-uppercase bc-tracking-wide">
              <div />
              <div>{__('User')}</div>
              <div>{__('Email')}</div>
              <div>{__('Roles')}</div>
              <BadgesColumnHeader />
              <div>{__('Capabilities')}</div>
            </div>

            {/* Rows */}
            <div className="bc-border bc-border-t-0 bc-border-solid bc-border-line bc-rounded-b bc-overflow-hidden">
              {usersData?.users?.map((user, idx) => (
                <div
                  className={`bc-grid bc-grid-cols-[40px_1fr_1fr_140px_160px_100px] bc-gap-3 bc-items-center bc-py-3 bc-px-3 ${
                    idx === (usersData.users?.length ?? 0) - 1
                      ? ''
                      : 'bc-border-b bc-border-solid bc-border-line'
                  }`}
                  key={user.ID}
                >
                  <Avatar size={32} src={user.avatar}>
                    {user.display_name.charAt(0).toUpperCase()}
                  </Avatar>

                  <div className="bc-overflow-hidden">
                    <Text className="bc-block bc-truncate bc-font-medium" title={user.display_name}>
                      {user.display_name}
                    </Text>
                    <Text
                      className="bc-block bc-truncate bc-text-xs"
                      title={user.user_login}
                      type="secondary"
                    >
                      @{user.user_login}
                    </Text>
                  </div>

                  <Text className="bc-truncate bc-text-sm" title={user.user_email} type="secondary">
                    {user.user_email}
                  </Text>

                  <div className="bc-flex bc-flex-wrap bc-gap-1">
                    {user.roles.map(role => (
                      <Tag className="bc-m-0 bc-text-xs" key={role}>
                        {role.replaceAll('_', ' ')}
                      </Tag>
                    ))}
                    {user.roles.length === 0 && (
                      <Text className="bc-text-xs" type="secondary">
                        {__('No role')}
                      </Text>
                    )}
                  </div>

                  <UserBadgesPopover
                    catalog={catalog}
                    disabled={isSavingBadges}
                    maxPerMember={maxPerMember}
                    onSave={badgeIds => saveUserBadges(user.ID, badgeIds)}
                    user={user}
                  />

                  <CapabilityPopover
                    disabled={isUpdating || isResetting}
                    onReset={() => resetUserCapabilities(user.ID)}
                    onSave={caps => handleSaveCaps(user.ID, caps)}
                    user={user}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {(usersData?.total_pages ?? 0) > 1 && (
              <div className="bc-flex bc-justify-end bc-mt-4">
                <Pagination
                  current={page}
                  onChange={setPage}
                  pageSize={20}
                  showSizeChanger={false}
                  showTotal={total => `${total} users`}
                  total={usersData?.total}
                />
              </div>
            )}
          </>
        )}
      </div>

      <RoleCapabilitiesModal onClose={() => setRoleModalOpen(false)} open={roleModalOpen} />
      <ProfileBadgesModal onClose={() => setBadgeModalOpen(false)} open={badgeModalOpen} />
    </div>
  )
}
