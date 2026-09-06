import { __ } from '@common/helpers/i18nWrap'
import { Skeleton } from 'antd'
import { useMemo } from 'react'
import { LuCheck, LuMinus } from 'react-icons/lu'

import { type UserPermission } from '../data/use-user-permissions'

/** Order the groups read in, rather than whatever the API happens to return. */
const GROUP_ORDER = ['Posting', 'Commenting', 'Voting', 'Moderation', 'Administration']

function PermissionRow({ permission }: { permission: UserPermission }) {
  const { allowed, label } = permission

  return (
    <li className="bc-flex bc-items-center bc-gap-2.5 bc-py-1.5">
      <span
        aria-hidden="true"
        className={[
          'bc-flex bc-h-[18px] bc-w-[18px] bc-shrink-0 bc-items-center bc-justify-center bc-rounded-full',
          allowed ? 'bc-bg-positive-soft bc-text-positive' : 'bc-bg-surface-sunken bc-text-ink-subtle'
        ].join(' ')}
      >
        {allowed ? <LuCheck size={11} strokeWidth={3} /> : <LuMinus size={11} strokeWidth={3} />}
      </span>
      <span className={allowed ? 'bc-text-ink' : 'bc-text-ink-subtle bc-line-through'}>{label}</span>
      {/* The icon is decorative, so the state needs saying for screen readers. */}
      <span className="bc-sr-only">{allowed ? __('allowed') : __('not allowed')}</span>
    </li>
  )
}

/**
 * What this member can do on the portal, grouped by area.
 *
 * Shown on your own profile (and to moderators). Denied capabilities are listed
 * rather than hidden: "you cannot pin topics" is the answer someone is looking
 * for, and an absent row answers nothing.
 */
export default function PermissionsPanel({
  isLoading,
  isOwnProfile,
  permissions
}: {
  isLoading: boolean
  isOwnProfile: boolean
  permissions: UserPermission[]
}) {
  const grouped = useMemo(() => {
    const byGroup = new Map<string, UserPermission[]>()

    for (const permission of permissions) {
      const list = byGroup.get(permission.group) ?? []
      list.push(permission)
      byGroup.set(permission.group, list)
    }

    return [...byGroup.entries()].sort(([a], [b]) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
  }, [permissions])

  if (!isLoading && permissions.length === 0) return

  return (
    <section
      aria-label={__('Permissions')}
      className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
    >
      <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
        {isOwnProfile ? __('What you can do') : __('What this member can do')}
      </h2>
      <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
        {__('Set by your role and any per-member overrides an admin has applied.')}
      </p>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} title={false} />
      ) : (
        <div className="bc-grid bc-gap-x-6 bc-gap-y-4 sm:bc-grid-cols-2">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <h3 className="bc-mb-1 bc-mt-0 bc-text-[11px] bc-font-semibold bc-uppercase bc-tracking-[0.06em] bc-text-ink-subtle">
                {group}
              </h3>
              <ul className="bc-m-0 bc-list-none bc-p-0 bc-text-[13px]">
                {items.map(permission => (
                  <PermissionRow key={permission.key} permission={permission} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
