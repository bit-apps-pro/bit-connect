import { __ } from '@common/helpers/i18nWrap'
import { Checkbox, Tooltip } from 'antd'
import { Fragment } from 'react'

import {
  type NotificationSettingsData,
  type NotificationTypeInfo,
  type NotificationTypeSettings
} from '../shared/types'

/**
 * Types addressed to one member about something of theirs — the ones worth
 * interrupting for. Anything not listed here, including a type another plugin
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

interface TypeMatrixProps {
  catalog: NotificationTypeInfo[]
  enabled: boolean
  onChange: (type: string, patch: Partial<NotificationTypeSettings>) => void
  types: NotificationSettingsData['types']
}

/**
 * The forum-wide default for every notification type, per channel.
 *
 * Grouped only for reading: the catalog order within a group is the server's,
 * and a group with nothing in it is not drawn.
 */
export default function TypeMatrix({ catalog, enabled, onChange, types }: TypeMatrixProps) {
  const groups = [
    {
      items: catalog.filter(info => !info.moderatorOnly && CONVERSATIONAL.has(info.type)),
      key: 'conversational',
      label: __('High-priority & conversational')
    },
    {
      items: catalog.filter(info => !info.moderatorOnly && !CONVERSATIONAL.has(info.type)),
      key: 'community',
      label: __('Community & system')
    },
    {
      items: catalog.filter(info => info.moderatorOnly),
      key: 'moderators',
      label: __('Moderators only')
    }
  ].filter(group => group.items.length > 0)

  return (
    <div className="bc-overflow-x-auto">
      <table className="bc-w-full bc-min-w-[36rem] bc-border-collapse bc-text-sm">
        <colgroup>
          <col />
          <col className="bc-w-32 lg:bc-w-44" />
          <col className="bc-w-32 lg:bc-w-44" />
          <col className="bc-w-40 lg:bc-w-52" />
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
                    <th className="bc-pb-3 bc-text-center bc-font-medium bc-text-ink" scope="col">
                      {__('Member may change')}
                    </th>
                  </>
                ) : (
                  <td colSpan={3} />
                )}
              </tr>

              {group.items.map(info => {
                const row = types[info.type]

                if (!row) return

                return (
                  <tr
                    className="bc-border-0 bc-border-t bc-border-solid bc-border-t-line"
                    key={info.type}
                  >
                    <th className="bc-py-4 bc-pe-4 bc-text-left bc-font-normal" scope="row">
                      <Tooltip placement="topLeft" title={info.description}>
                        <span className="bc-text-sm bc-text-ink">{info.label}</span>
                      </Tooltip>
                    </th>
                    <td className="bc-py-4 bc-text-center">
                      {/* Where the forum sends it regardless, say so in words:
                          an admin switch that changes nothing is worse than
                          no switch at all. */}
                      {info.mandatoryInApp ? (
                        <Tooltip title={__('This is always delivered in the app.')}>
                          <span className="bc-text-xs bc-text-ink-subtle">{__('Always')}</span>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          aria-label={`${info.label}: ${__('In app')}`}
                          checked={row.inapp}
                          disabled={!enabled}
                          onChange={event => onChange(info.type, { inapp: event.target.checked })}
                        />
                      )}
                    </td>
                    <td className="bc-py-4 bc-text-center">
                      <Checkbox
                        aria-label={`${info.label}: ${__('Email')}`}
                        checked={row.email}
                        disabled={!enabled}
                        onChange={event => onChange(info.type, { email: event.target.checked })}
                      />
                    </td>
                    <td className="bc-py-4 bc-text-center">
                      {info.moderatorOnly ? (
                        <Tooltip
                          title={__(
                            'Only moderators receive this, so there is nothing for a member to change.'
                          )}
                        >
                          <span className="bc-text-xs bc-text-ink-subtle">-</span>
                        </Tooltip>
                      ) : (
                        <Checkbox
                          aria-label={`${info.label}: ${__('Member may change')}`}
                          checked={row.userMayOverride}
                          disabled={!enabled}
                          onChange={event =>
                            onChange(info.type, { userMayOverride: event.target.checked })
                          }
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
