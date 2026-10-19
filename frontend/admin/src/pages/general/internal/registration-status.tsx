import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { Button, Divider, Typography } from 'antd'
import { LuExternalLink, LuUserCheck, LuUserX } from 'react-icons/lu'

const { Text } = Typography

interface RegistrationStatusProps {
  /** WordPress's "Anyone can register". */
  canRegister: boolean
  /** The screen that holds that setting, '' when the current user cannot open it. */
  settingsUrl: string
}

/**
 * Whether the built-in form takes new accounts.
 *
 * The form follows WordPress's own "Anyone can register", so with it off the
 * registration page only says "Registration is closed" and the form seems
 * broken. This shows that setting and links to it; it does not change it —
 * the option belongs to WordPress, and the forum's own capability does not
 * make someone a site administrator.
 */
export default function RegistrationStatus({ canRegister, settingsUrl }: RegistrationStatusProps) {
  const Icon = canRegister ? LuUserCheck : LuUserX

  return (
    <>
      <Divider className="bc-my-0" />
      <div className="bc-py-4">
        <div
          className={cn([
            'bc-flex bc-flex-wrap bc-items-center bc-gap-3 bc-rounded-md bc-border bc-border-solid bc-border-line bc-p-3',
            canRegister ? 'bc-bg-surface-sunken' : 'bc-bg-tone-amber-soft'
          ])}
        >
          <span
            aria-hidden
            className={cn([
              'bc-flex bc-size-9 bc-shrink-0 bc-items-center bc-justify-center bc-rounded-full',
              canRegister ? 'bc-bg-positive-soft bc-text-positive' : 'bc-bg-surface bc-text-tone-amber'
            ])}
          >
            <Icon size={18} />
          </span>

          <div className="bc-min-w-0 bc-flex-1">
            <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
              <Text className="bc-text-sm bc-text-inherit" strong>
                {__('Anyone can register')}
              </Text>
              <span
                className={cn([
                  'bc-inline-flex bc-items-center bc-gap-1.5 bc-text-xs bc-font-medium',
                  canRegister ? 'bc-text-positive' : 'bc-text-tone-amber'
                ])}
              >
                <span aria-hidden className="bc-size-1.5 bc-rounded-full bc-bg-current" />
                {canRegister ? __('On') : __('Off')}
              </span>
            </div>
            <Text className="bc-mt-0.5 bc-block bc-text-xs" type="secondary">
              {canRegister
                ? __('People can create an account on the portal. WordPress controls this setting.')
                : settingsUrl
                  ? __(
                      'People cannot create an account on the portal. To allow it, turn on this setting in WordPress.'
                    )
                  : __(
                      'People cannot create an account on the portal. Ask a site administrator to turn on this setting in WordPress.'
                    )}
            </Text>
          </div>

          {settingsUrl && (
            <Button
              href={settingsUrl}
              icon={<LuExternalLink aria-hidden size={13} />}
              iconPosition="end"
              size="small"
              type={canRegister ? 'default' : 'primary'}
            >
              {__('Open settings')}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
