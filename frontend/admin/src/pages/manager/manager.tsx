import { __ } from '@common/helpers/i18nWrap'
import useDebounce from '@common/hooks/useDebounce'
import { Avatar, Button, Input, Pagination, Spin, theme, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { LuSearch } from 'react-icons/lu'

import useBadgesAdmin from './data/use-badges-admin'
import useResetUserCapabilities from './data/use-reset-user-capabilities'
import useUserCapabilitiesAdmin from './data/use-user-capabilities-admin'
import useUsers from './data/use-users'
import { type ForumCapability } from './shared/types'
import CapabilityPopover from './ui/capability-popover'
import ProfileBadgesModal from './ui/profile-badges-modal'
import RoleCapabilitiesModal from './ui/role-capabilities-modal'
import UserBadgesPopover from './ui/user-badges-popover'

const { Text, Title } = Typography

// ---- Page -------------------------------------------------------------------

export default function Manager() {
  const { token } = theme.useToken()
  // A hairline above every row after the header, in the rule antd draws
  // between table rows. Inline rather than a `border-t` class: preflight is off
  // in this app, so `border-solid` on its own would draw the browser's default
  // border on all four sides and box each row in.
  const rowRule = { borderTop: `1px solid ${token.colorBorderSecondary}` }
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [badgeModalOpen, setBadgeModalOpen] = useState(false)

  const { isUsersFetching, usersData } = useUsers({ page, perPage: 20, search: debouncedSearch })
  // One hook for per-user overrides, so this page never names the pro-only
  // endpoint and the free build can drop it. See use-user-capabilities-admin.ts.
  const { isUpdating, saveUserCapabilities } = useUserCapabilitiesAdmin()
  const { isResetting, resetUserCapabilities } = useResetUserCapabilities()
  // One hook for the whole badge feature, so this page never names the pro-only
  // endpoints and the free build can drop them. See use-badges-admin.ts.
  const { catalog, hasBadgeCatalog, isSavingBadges, maxPerMember, saveUserBadges } = useBadgesAdmin()

  // The Badges column exists only where badges do. Written as a style rather
  // than a Tailwind arbitrary value because the two templates have to differ
  // between builds, and only the free tree is scanned for classes — an
  // arbitrary `grid-cols-[…]` that appeared solely in the add-on's source
  // would be purged out of the pro bundle.
  const gridTemplateColumns = hasBadgeCatalog
    ? 'minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) 160px 140px'
    : 'minmax(0,1.3fr) minmax(0,1.3fr) minmax(0,1fr) 140px'

  const handleSearch = useDebounce((value: string) => {
    setDebouncedSearch(value)
    setPage(1)
  }, 350)

  const handleSaveCaps = useCallback(
    async (userId: number, caps: Record<ForumCapability, boolean>) => {
      await saveUserCapabilities(userId, caps)
    },
    [saveUserCapabilities]
  )

  return (
    <div className="bc-px-6 bc-pb-6">
      <div className="bc-min-w-0 bc-pb-4 bc-pt-5">
        <Title className="bc-mb-0.5" level={3}>
          {__('Manage Users')}
        </Title>
        {/* Two sentences, because this screen does two different jobs
            depending on what is installed — and the standing one has to
            describe what an admin can actually do here. */}
        <Text className="bc-text-xs" type="secondary">
          {hasBadgeCatalog
            ? __(
                'View all WordPress users, adjust individual forum capabilities and hand out profile badges. Use Role Capabilities to set defaults per role.'
              )
            : __(
                'View all WordPress users and see the forum capabilities each one holds. Use Role Capabilities to set them per role.'
              )}
        </Text>
      </div>

      <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
        {/* Searches as the admin types, a pause after the last key, rather
            than waiting for Enter behind a button. */}
        <Input
          allowClear
          className="bc-max-w-xs"
          onChange={event => handleSearch(event.target.value.trim())}
          placeholder={__('Search by name, email or username…')}
          prefix={<LuSearch aria-hidden className="bc-text-ink-subtle" />}
        />
        <div className="bc-flex bc-shrink-0 bc-gap-2">
          {/* Only where a catalog can exist. A button that opens a description
              of a feature this plugin does not have is a placeholder for it,
              and this plugin draws none: what the add-on adds is said once, in
              words, on the Support screen. */}
          {hasBadgeCatalog && (
            <Button onClick={() => setBadgeModalOpen(true)}>{__('Profile Badges')}</Button>
          )}
          <Button onClick={() => setRoleModalOpen(true)} type="primary">
            {__('Role Capabilities')}
          </Button>
        </div>
      </div>

      {/* The layout's ground is sunken, so the list sits on its own raised
          card, like the General screen's sections. */}
      <div
        className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line"
        style={{ backgroundColor: token.colorBgContainer }}
      >
        {/* The card and its header are painted the way antd paints a table —
            the translucent header fill laid over the container colour — so
            this list reads as the same kind of table as Stages or Tags. The
            sunken surface it used before is the page's own ground, and on it
            the header looked like a hole in the card. */}
        <div
          className="bc-grid bc-gap-3 bc-px-4 bc-py-3 bc-text-sm bc-font-semibold"
          style={{
            background: `linear-gradient(${token.colorFillAlter}, ${token.colorFillAlter}) ${token.colorBgContainer}`,
            color: token.colorTextHeading,
            gridTemplateColumns
          }}
        >
          <div>{__('User')}</div>
          <div>{__('Email')}</div>
          <div>{__('Roles')}</div>
          {hasBadgeCatalog && <div>{__('Badges')}</div>}
          <div>{__('Capabilities')}</div>
        </div>

        {isUsersFetching && (
          <div className="bc-flex bc-justify-center bc-py-16" style={rowRule}>
            <Spin />
          </div>
        )}
        {!isUsersFetching && !usersData?.users?.length && (
          <div className="bc-py-16 bc-text-center bc-text-sm bc-text-ink-subtle" style={rowRule}>
            {__('No users found.')}
          </div>
        )}
        {!isUsersFetching &&
          usersData?.users?.map(user => (
            <div
              className="bc-grid bc-items-center bc-gap-3 bc-px-4 bc-py-2.5"
              key={user.ID}
              style={{ ...rowRule, gridTemplateColumns }}
            >
              <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2.5">
                <Avatar className="bc-shrink-0" size={30} src={user.avatar}>
                  {user.display_name.charAt(0).toUpperCase()}
                </Avatar>
                <div className="bc-min-w-0">
                  <Text className="bc-block bc-truncate bc-text-sm bc-font-medium" title={user.display_name}>
                    {user.display_name}
                  </Text>
                  <Text className="bc-block bc-truncate bc-text-xs" title={user.user_login} type="secondary">
                    @{user.user_login}
                  </Text>
                </div>
              </div>

              <Text className="bc-truncate bc-text-sm" title={user.user_email}>
                {user.user_email}
              </Text>

              <Text className="bc-truncate bc-text-xs" type="secondary">
                {user.roles.length > 0
                  ? user.roles.map(role => role.replaceAll('_', ' ')).join(', ')
                  : __('No role')}
              </Text>

              {hasBadgeCatalog && (
                <UserBadgesPopover
                  catalog={catalog}
                  disabled={isSavingBadges}
                  maxPerMember={maxPerMember}
                  onSave={badgeIds => saveUserBadges(user.ID, badgeIds)}
                  user={user}
                />
              )}

              <CapabilityPopover
                disabled={isUpdating || isResetting}
                onReset={() => resetUserCapabilities(user.ID)}
                onSave={caps => handleSaveCaps(user.ID, caps)}
                user={user}
              />
            </div>
          ))}
      </div>

      {(usersData?.total_pages ?? 0) > 1 && (
        <div className="bc-mt-4 bc-flex bc-justify-end">
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

      <RoleCapabilitiesModal onClose={() => setRoleModalOpen(false)} open={roleModalOpen} />
      <ProfileBadgesModal onClose={() => setBadgeModalOpen(false)} open={badgeModalOpen} />
    </div>
  )
}
