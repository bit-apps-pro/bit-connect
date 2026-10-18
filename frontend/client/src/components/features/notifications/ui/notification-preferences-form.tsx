import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import SettingsCard from '@utilities/settings-card'
import { Alert, Checkbox, Radio, Skeleton, Switch, Tooltip } from 'antd'
import { Fragment, useContext } from 'react'

import {
  type NotificationPreferenceRow,
  useFollowForum,
  useNotificationPreferences,
  useSaveNotificationPreferences
} from '../data/use-notification-preferences'

/**
 * "What do you want to hear about, and how?"
 *
 * Laid out like the admin's Notifications screen — a card per setting, and the
 * types as a grouped matrix of In app / Email checkboxes — so a member reading
 * their own settings sees the same shape the forum's defaults were set in.
 *
 * Saves on every change rather than behind a Save button. There is no valid
 * combination to guard — each row is independent, nothing here can be
 * half-finished, and a settings screen that silently discards changes because
 * somebody navigated away without pressing Save is a worse failure than an
 * extra request. The server answers with the whole screen, so a rejected row
 * corrects itself in place.
 *
 * Locked rows are shown rather than hidden. A member who cannot switch
 * something off should still be able to see that the forum sends it — hiding
 * the row would leave them wondering where the mail comes from.
 */

/**
 * One word each: the card's subtitle already says these are how often email
 * arrives, and the spelled-out labels were wider than a phone.
 */
const FREQUENCIES = [
  { label: __('Instant'), value: 'instant' },
  { label: __('Daily'), value: 'daily' },
  { label: __('Weekly'), value: 'weekly' },
  { label: __('Never'), value: 'never' }
]

/**
 * Types addressed to one member about something of theirs. Mirrors the admin
 * matrix's grouping; anything not listed, including a type another plugin
 * adds, falls into the community group.
 */
const CONVERSATIONAL = new Set([
  'comment_reply',
  'mention',
  'report_resolved',
  'topic_new',
  'topic_reply',
  'vote_received'
])

const ADMIN_LOCKED = () => __('Your administrator has set this for everyone.')

function ChannelCell({
  checked,
  label,
  locked,
  onChange
}: {
  checked: boolean
  label: string
  locked: boolean
  onChange: (next: boolean) => void
}) {
  const box = (
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={locked}
      onChange={event => onChange(event.target.checked)}
    />
  )

  return locked ? <Tooltip title={ADMIN_LOCKED()}>{box}</Tooltip> : box
}

export default function NotificationPreferencesForm() {
  const { notificationApi } = useContext(NotifyContext)
  const { isPreferencesError, isPreferencesLoading, preferences } = useNotificationPreferences()
  const { savePreferences } = useSaveNotificationPreferences()
  const { isTogglingForumFollow, toggleForumFollow } = useFollowForum()

  const reportFailure = () => {
    notificationApi?.error({
      message: __('That could not be saved. Please check your connection and try again.')
    })
  }

  // One key for every save on this screen: ticking five boxes in a row updates
  // a single "saved" message instead of stacking five of them.
  // A refusal can also arrive as a 200 whose body says so; that is a failure
  // too, not something to call saved.
  const reportSaved = (response?: { status?: string }) => {
    if (response?.status === 'error') {
      reportFailure()
      return
    }
    notificationApi?.success({
      key: 'notification-preferences-saved',
      message: __('Notification settings saved')
    })
  }

  const commit = (payload: Parameters<typeof savePreferences>[0]) => {
    savePreferences(payload).then(reportSaved, reportFailure)
  }

  const toggle = (row: NotificationPreferenceRow, channel: 'email' | 'inapp', next: boolean) => {
    commit({ types: { [row.type]: { [channel]: next } } })
  }

  if (isPreferencesLoading) {
    return (
      <SettingsCard title={__('Notifications')}>
        <Skeleton active paragraph={{ rows: 6 }} title={false} />
      </SettingsCard>
    )
  }

  if (isPreferencesError || !preferences) {
    return <Alert message={__('Your notification settings could not be loaded.')} type="error" />
  }

  const groups = [
    {
      items: preferences.types.filter(row => !row.moderatorOnly && CONVERSATIONAL.has(row.type)),
      key: 'conversational',
      label: __('High-priority & conversational')
    },
    {
      items: preferences.types.filter(row => !row.moderatorOnly && !CONVERSATIONAL.has(row.type)),
      key: 'community',
      label: __('Community & system')
    },
    {
      items: preferences.types.filter(row => row.moderatorOnly),
      key: 'moderators',
      label: __('Moderators only')
    }
  ].filter(group => group.items.length > 0)

  return (
    <div className="bc-flex bc-flex-col bc-gap-4">
      <SettingsCard
        extra={
          // Radio buttons rather than antd's Segmented: Segmented restores its
          // selected class on a motion-end event this app never receives, so
          // after the first click it shows nothing selected.
          <Radio.Group
            aria-label={__('Email frequency')}
            buttonStyle="solid"
            onChange={event => commit({ frequency: String(event.target.value) })}
            options={FREQUENCIES}
            optionType="button"
            value={preferences.frequency}
          />
        }
        subtitle={__(
          'How often emails arrive. This only changes when they are sent, not what you are notified about.'
        )}
        title={__('Email frequency')}
      />

      <SettingsCard
        extra={
          <Switch
            aria-label={__('Tell me about every new topic')}
            checked={preferences.followsForum}
            loading={isTogglingForumFollow}
            onChange={next => {
              toggleForumFollow(next).then(reportSaved, reportFailure)
            }}
          />
        }
        subtitle={__(
          'Get a notification for every topic posted anywhere on the portal, not only under what you follow.'
        )}
        title={__('Tell me about every new topic')}
      />

      <SettingsCard
        subtitle={__('Changes save as you make them. Hover a notification to see when it is sent.')}
        title={__('What you are notified about')}
      >
        <div className="bc-overflow-x-auto">
          {/* Two checkbox columns fit a phone once they narrow, so the table
              shrinks with the card instead of hiding Email off the edge. */}
          <table className="bc-w-full bc-border-collapse bc-text-sm">
            <colgroup>
              <col />
              <col className="bc-w-16 sm:bc-w-24 lg:bc-w-36" />
              <col className="bc-w-16 sm:bc-w-24 lg:bc-w-36" />
            </colgroup>
            <tbody>
              {groups.map((group, index) => (
                <Fragment key={group.key}>
                  <tr>
                    <td className={`bc-pb-3 ${index > 0 ? 'bc-pt-6' : ''}`}>
                      <span className="bc-inline-block bc-rounded-md bc-bg-surface-sunken bc-px-2.5 bc-py-1 bc-text-sm bc-font-medium bc-text-ink">
                        {group.label}
                      </span>
                    </td>
                    {/* The column names ride the first group's row, as in a
                        sheet header, rather than taking a row of their own. */}
                    {index === 0 ? (
                      <>
                        <th className="bc-pb-3 bc-text-center bc-font-medium bc-text-ink" scope="col">
                          {__('In app')}
                        </th>
                        <th className="bc-pb-3 bc-text-center bc-font-medium bc-text-ink" scope="col">
                          {__('Email')}
                        </th>
                      </>
                    ) : (
                      <td colSpan={2} />
                    )}
                  </tr>

                  {group.items.map(row => (
                    <tr
                      className="bc-border-0 bc-border-t bc-border-solid bc-border-t-line"
                      key={row.type}
                    >
                      <th className="bc-py-4 bc-pe-4 bc-text-left bc-font-normal" scope="row">
                        <Tooltip placement="topLeft" title={row.description}>
                          <span className="bc-text-sm bc-text-ink">{row.label}</span>
                        </Tooltip>
                      </th>
                      <td className="bc-py-4 bc-text-center">
                        {/* Where the forum sends it regardless, say so in
                            words: a checkbox that cannot be cleared reads as
                            broken, not as a rule. */}
                        {row.alwaysDelivered ? (
                          <Tooltip title={__('This forum always tells you about this.')}>
                            <span className="bc-text-xs bc-text-ink-subtle">{__('Always')}</span>
                          </Tooltip>
                        ) : (
                          <ChannelCell
                            checked={row.inapp}
                            label={`${row.label}: ${__('In app')}`}
                            locked={row.inappLocked}
                            onChange={next => toggle(row, 'inapp', next)}
                          />
                        )}
                      </td>
                      <td className="bc-py-4 bc-text-center">
                        <ChannelCell
                          checked={row.email}
                          label={`${row.label}: ${__('Email')}`}
                          locked={row.emailLocked}
                          onChange={next => toggle(row, 'email', next)}
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {preferences.frequency === 'never' && (
          <Alert
            className="bc-mt-4"
            message={__(
              'Email is switched off entirely, so the Email column has no effect until you choose a frequency above.'
            )}
            showIcon
            type="info"
          />
        )}
      </SettingsCard>
    </div>
  )
}
