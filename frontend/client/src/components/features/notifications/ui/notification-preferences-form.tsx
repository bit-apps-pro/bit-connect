import NotifyContext from '@common/context/NotifyContext'
import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { Alert, Radio, Skeleton, Switch, Tooltip, Typography } from 'antd'
import { useContext } from 'react'
import { LuInbox, LuLock, LuMail } from 'react-icons/lu'

import {
  type NotificationPreferenceRow,
  useNotificationPreferences,
  useSaveNotificationPreferences
} from '../data/use-notification-preferences'
import appearanceFor from '../shared/appearance'

const { Title } = Typography

/**
 * "What do you want to hear about, and how?"
 *
 * Saves on every switch rather than behind a Save button. There is no valid
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
 * One word each, and rendered `block` so the four share the width.
 *
 * "Immediately" and "Weekly digest" spelled out came to 361px, which is wider
 * than a 364px phone — the last option was clipped off the edge with nothing to
 * scroll. The paragraph above already says these are how often email arrives,
 * so the longer labels were repeating it rather than adding to it.
 */
const FREQUENCIES = [
  { label: __('Instant'), value: 'instant' },
  { label: __('Daily'), value: 'daily' },
  { label: __('Weekly'), value: 'weekly' },
  { label: __('Never'), value: 'never' }
]

interface ChannelSwitchProps {
  checked: boolean
  disabled: boolean
  /** Why it cannot be changed — the forum requires it, or an admin locked it. */
  lockReason?: string
  onChange: (next: boolean) => void
}

function ChannelSwitch({ checked, disabled, lockReason, onChange }: ChannelSwitchProps) {
  const control = (
    <span className="bc-inline-flex bc-items-center bc-gap-1.5">
      <Switch checked={checked} disabled={disabled} onChange={onChange} size="small" />
      {disabled && <LuLock className="bc-text-ink-subtle" size={12} />}
    </span>
  )

  return disabled && lockReason ? <Tooltip title={lockReason}>{control}</Tooltip> : control
}

export default function NotificationPreferencesForm() {
  const { notificationApi } = useContext(NotifyContext)
  const { isPreferencesError, isPreferencesLoading, preferences } = useNotificationPreferences()
  const { savePreferences } = useSaveNotificationPreferences()

  const commit = (payload: Parameters<typeof savePreferences>[0]) => {
    savePreferences(payload).catch(() => {
      notificationApi?.error({
        message: __('That could not be saved. Please check your connection and try again.')
      })
    })
  }

  const toggle = (row: NotificationPreferenceRow, channel: 'email' | 'inapp', next: boolean) => {
    commit({ types: { [row.type]: { [channel]: next } } })
  }

  if (isPreferencesLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} title />
  }

  if (isPreferencesError || !preferences) {
    return <Alert message={__('Your notification settings could not be loaded.')} type="error" />
  }

  return (
    <div className="bc-flex bc-flex-col bc-gap-6">
      <section>
        <Title className="bc-mb-1" level={5}>
          {__('Email frequency')}
        </Title>
        <p className="bc-mb-3 bc-text-sm bc-text-ink-subtle">
          {__(
            'How often email should arrive. This does not change what you are notified about — only when it is sent.'
          )}
        </p>
        {/* Radio buttons rather than antd's Segmented. Segmented paints its
            selection with an animated thumb and restores the selected class on
            motion-end; in this app that event never fires, so after the first
            click the control shows nothing selected while its radio is
            correctly checked. Radio.Group in button mode looks the same and
            keeps its state in the input, where it cannot be lost. */}
        <Radio.Group
          buttonStyle="solid"
          onChange={event => commit({ frequency: String(event.target.value) })}
          options={FREQUENCIES}
          optionType="button"
          value={preferences.frequency}
        />
      </section>

      <section>
        <Title className="bc-mb-1" level={5}>
          {__('What you are notified about')}
        </Title>
        <p className="bc-mb-3 bc-text-sm bc-text-ink-subtle">{__('Changes save as you make them.')}</p>

        <div className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line">
          {/* Column headers, so the two switches are not left to be guessed at.
              Hidden below sm, where each row stacks and the icons label
              themselves. */}
          <div className="bc-hidden bc-items-center bc-gap-4 bc-border-0 bc-border-b bc-border-solid bc-border-line bc-bg-surface-sunken bc-px-4 bc-py-2 sm:bc-flex">
            <span className="bc-flex-1 bc-text-xs bc-font-medium bc-text-ink-subtle">
              {__('Notification')}
            </span>
            <span className="bc-flex bc-w-16 bc-items-center bc-justify-center bc-gap-1 bc-text-xs bc-font-medium bc-text-ink-subtle">
              <LuInbox size={13} /> {__('App')}
            </span>
            <span className="bc-flex bc-w-16 bc-items-center bc-justify-center bc-gap-1 bc-text-xs bc-font-medium bc-text-ink-subtle">
              <LuMail size={13} /> {__('Email')}
            </span>
          </div>

          {preferences.types.map((row, index) => {
            const { bg, fg, Icon } = appearanceFor(row.type)

            return (
              // Stacked on a phone, three columns from sm. Side by side at
              // 364px the two 64px switch columns left the label about 140px to
              // live in, which wrapped "Someone comments on your topic" onto
              // four lines and its description onto seven. Below the text the
              // switches get their own labels, since the column headers they
              // rely on are hidden at that width.
              <div
                className={cn([
                  'bc-flex bc-flex-col bc-gap-3 bc-px-4 bc-py-3',
                  'sm:bc-flex-row sm:bc-items-center sm:bc-gap-4',
                  index > 0 && 'bc-border-0 bc-border-t bc-border-solid bc-border-t-line'
                ])}
                key={row.type}
              >
                <span className="bc-flex bc-min-w-0 bc-flex-1 bc-items-start bc-gap-3">
                  <span
                    className={cn([
                      'bc-flex bc-h-8 bc-w-8 bc-shrink-0 bc-items-center bc-justify-center',
                      'bc-rounded-full',
                      bg,
                      fg
                    ])}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="bc-min-w-0">
                    <span className="bc-block bc-text-sm bc-font-medium bc-text-ink">{row.label}</span>
                    <span className="bc-block bc-text-xs bc-text-ink-subtle">{row.description}</span>
                  </span>
                </span>

                {/* Indented to the text's left edge on mobile so the controls
                    read as belonging to the row above them. */}
                <span className="bc-flex bc-items-center bc-gap-6 bc-ps-11 sm:bc-gap-0 sm:bc-ps-0">
                  <span className="bc-flex bc-items-center bc-gap-2 sm:bc-w-16 sm:bc-justify-center">
                    <span className="bc-text-xs bc-text-ink-subtle sm:bc-hidden">{__('App')}</span>
                    <ChannelSwitch
                      checked={row.inapp}
                      disabled={row.inappLocked}
                      lockReason={
                        row.alwaysDelivered
                          ? __('This forum always tells you about this.')
                          : __('Your administrator has set this for everyone.')
                      }
                      onChange={next => toggle(row, 'inapp', next)}
                    />
                  </span>

                  <span className="bc-flex bc-items-center bc-gap-2 sm:bc-w-16 sm:bc-justify-center">
                    <span className="bc-text-xs bc-text-ink-subtle sm:bc-hidden">{__('Email')}</span>
                    <ChannelSwitch
                      checked={row.email}
                      disabled={row.emailLocked}
                      lockReason={__('Your administrator has set this for everyone.')}
                      onChange={next => toggle(row, 'email', next)}
                    />
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        {preferences.frequency === 'never' && (
          <Alert
            className="bc-mt-3"
            message={__(
              'Email is switched off entirely, so the Email column has no effect until you choose a frequency above.'
            )}
            showIcon
            type="info"
          />
        )}
      </section>
    </div>
  )
}
