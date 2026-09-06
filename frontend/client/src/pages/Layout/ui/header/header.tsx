import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import config from '@config/config'
import { NotificationBell } from '@features/notifications'
import useTopicModalStore from '@features/topic-modal/state/use-topic-modal-store'
import TopicCreateModal from '@features/topic-modal/ui/topic-create-modal'
import TopicEditModal from '@features/topic-modal/ui/topic-edit-modal'
import logo from '@resource/img/logo.svg'
import ThemeToggle from '@utilities/theme-toggle'
import { userProfilePath } from '@utilities/user-link'
import { externalLoginUrl, externalRegisterUrl, registrationIsOffered } from '@utils/auth-urls'
import { Avatar, Button, Dropdown, Grid } from 'antd'
import { useEffect } from 'react'
import { LuChevronDown, LuLogIn, LuLogOut, LuMenu, LuPlus, LuUser, LuUserPlus } from 'react-icons/lu'
import { Link, useLocation } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'

interface HeaderProps {
  /** True once content has scrolled beneath the bar; drawn by Layout. */
  isScrolled?: boolean
  onMenuOpen?: () => void
}

export default function Header({ isScrolled = false, onMenuOpen }: HeaderProps) {
  const { setCreateModalOpen } = useTopicModalStore()
  const location = useLocation()
  const { checkAuth, isLoggedIn, logout, user } = useAuthStore()
  const { fetchSettings } = useAdminSettingsStore()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    fetchSettings().catch(console.error)
  }, [fetchSettings])

  useEffect(() => {
    if (!isLoggedIn || !user) {
      checkAuth()
    }
  }, [checkAuth, isLoggedIn, user])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Router paths never carry the portal basename, so the return URL has to be
  // rebuilt before it leaves the SPA. Undefined in plugin-default mode, where
  // the portal renders its own login route.
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const customLoginUrl = externalLoginUrl(currentPath)
  const customRegisterUrl = externalRegisterUrl(currentPath)
  const canRegister = registrationIsOffered()

  const userMenuItems = isLoggedIn
    ? [
        ...(user
          ? [
              {
                disabled: true,
                key: 'account',
                label: (
                  <div className="bc-px-2 bc-py-1">
                    <div className="bc-font-semibold">{user.display_name || user.username}</div>
                    <div className="bc-text-xs bc-text-ink-muted">{user.email}</div>
                  </div>
                )
              },
              {
                type: 'divider' as const
              },
              {
                key: 'profile',
                label: (
                  // Slug when the backend supplied one; the profile endpoint
                  // also resolves numeric ids, so a stale cached user without
                  // a slug still lands on the right page.
                  <Link
                    className="bc-flex bc-items-center bc-gap-2 bc-text-inherit bc-no-underline"
                    to={userProfilePath(user.slug || String(user.id))}
                  >
                    <LuUser style={{ fontSize: 14 }} />
                    {__('My Profile')}
                  </Link>
                )
              }
            ]
          : []),
        {
          key: 'logout',
          label: (
            <span className="bc-flex bc-items-center bc-gap-2">
              <LuLogOut style={{ fontSize: 14 }} />
              {__('Log Out')}
            </span>
          ),
          onClick: handleLogout
        },
        // Phone width only: the bar there was carrying a menu button, a logo, a
        // theme button, a bell, Create and the avatar — six controls, two of
        // them opening menus of their own. The theme control gives up its slot
        // and moves in here (the header renders none below `md` once someone is
        // logged in; see `withoutMenu`), last and behind a divider, because a
        // display preference belongs under the account actions, not among them.
        //
        // A childless `group` rather than a `disabled` item, though both render
        // an inert row: the pill owns its own clicks and needs the menu to stay
        // open across a choice, and only a group is inert without claiming so —
        // `disabled` would hang `aria-disabled` over a live three-way switch.
        // A group title is not a menuitem, so rc-menu never fires the click
        // that closes the dropdown, and the radios keep their own semantics.
        ...(isMobile
          ? [
              { type: 'divider' as const },
              {
                children: [],
                key: 'theme',
                label: <ThemeToggle block />,
                type: 'group' as const
              }
            ]
          : [])
      ]
    : []

  // Logo + title. On phones the title truncates to one line (and is a touch
  // smaller) instead of wrapping; desktop keeps the xl size via md:.
  const brand = (
    <>
      <img
        alt={`${config.COMMUNITY_TITLE || config.PRODUCT_NAME} logo`}
        className="bc-h-8 bc-w-8 bc-shrink-0 bc-object-contain"
        src={config.LOGO_LIGHT || logo}
      />
      <span className="bc-hidden bc-truncate bc-font-bold bc-text-lg bc-text-ink md:bc-inline md:bc-text-xl">
        {config.COMMUNITY_TITLE || config.PRODUCT_NAME}
      </span>
    </>
  )

  return (
    <>
      {/* The rule is drawn only while something is scrolled underneath it. At
          rest it separated nothing: on a phone, where the content below is the
          same surface colour as the bar, it read as a line ruled across the top
          of the screen for its own sake, and it was the first thing under the
          logo. Scrolled, it is doing real work — text passing beneath a bar of
          identical colour needs the edge — so it fades in then. Layout owns the
          `isScrolled` flag; see the sentinel there.

          The colour changes, not the width: a border appearing from nothing
          would shift the whole page down by 1px on the first scroll.

          The rule needs all four border utilities. Preflight is off
          (tailwind.config.mjs), so nothing supplies the `border-style: solid`
          Tailwind normally resets for — `bc-border-b` alone set a width against
          the initial `border-style: none` and drew no line at all. `bc-border-0`
          first because `bc-border-solid` applies to all four sides, and the
          three without an explicit width would otherwise fall back to `medium`
          and frame the header. */}
      <header
        className={cn([
          'bc-sticky bc-top-0 bc-z-20 bc-border-0 bc-border-b bc-border-solid bc-bg-surface bc-px-4 bc-py-3',
          'bc-transition-colors bc-duration-200',
          isScrolled ? 'bc-border-line' : 'bc-border-transparent'
        ])}
      >
        <div className="bc-flex bc-items-center bc-justify-between bc-gap-4">
          <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-3">
            {isMobile && (
              <Button
                aria-label={__('Open menu')}
                className="bc-shrink-0"
                // Lucide draws the same 2px stroke at every size, so scaling an
                // icon up thins it out relative to its own box: at 22 this was
                // the largest glyph in the bar and the lightest, three hairlines
                // beside the 16px icons to its right. Smaller with a heavier
                // stroke reads at the weight of its neighbours. Round caps
                // because every other icon in the bar has them — Lucide's
                // default — and square ends on the one hand-tuned icon showed.
                icon={<LuMenu size={20} strokeLinecap="round" strokeWidth={2.5} />}
                onClick={onMenuOpen}
                type="text"
              />
            )}
            {config.LOGO_PERMALINK_MODE === 'custom' && config.LOGO_PERMALINK_CUSTOM ? (
              <a
                className="bc-flex bc-min-w-0 bc-items-center bc-gap-3 bc-no-underline"
                href={config.LOGO_PERMALINK_CUSTOM}
              >
                {brand}
              </a>
            ) : (
              <Link className="bc-flex bc-min-w-0 bc-items-center bc-gap-3 bc-no-underline" to="/">
                {brand}
              </Link>
            )}
          </div>
          <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-1">
            {/* Before the account controls: this is a display preference, not an
                account action, and it has to stay reachable for logged-out
                visitors — who are most of the portal's traffic. They keep the
                phone-width button too, having no account menu to hold it. */}
            <ThemeToggle withoutMenu={isLoggedIn} />
            {/* Logged-in only, like Create below it: a guest has no
                notifications, and an empty bell invites a click that can only
                disappoint. */}
            {isLoggedIn && <NotificationBell />}
            {isLoggedIn && (
              // The label steps up with the room to hold it: a plus alone on a
              // phone, "New" once a wide phone can carry a word, the whole
              // sentence on desktop. It used to keep antd's sentence-sized
              // flanks around that one short word, which made the loudest and
              // widest object in the bar out of its smallest label — beside a
              // 36px bell and a 36px menu button, on the row with the least
              // room. Sized to them it joins their rhythm instead of breaking
              // it.
              //
              // `round` at every width, so the same rule draws a disc on a
              // phone and a lozenge once the label arrives. This is the only
              // filled object in the bar, and squared off it read as a sticker
              // pasted between the bell and the avatar: a hard 8px-cornered
              // block of solid blue, the one shape on the row that answered
              // nothing else on it. Round, it answers both of its neighbours —
              // the avatar's circle on one side, and on desktop the pill the
              // theme control already wears on the other.
              //
              // The glyph carries the disc rather than the fill: 18px on a
              // phone, the bell's size, stepping back to 16 beside the label
              // where the word does the work. The heavier stroke is the menu
              // button's trick — Lucide draws 2px at every size, so a glyph
              // thins out as it grows.
              //
              // The name is spelled out for assistive tech at every width: below
              // `sm` both labels are `display: none`, and a button whose only
              // content is an icon has no accessible name at all.
              //
              // Margins over antd's: the plus is centred in the disc (no
              // trailing margin against nothing), and the gap to the label is
              // ours rather than antd's `icon + span`, which would otherwise
              // land on whichever of the two labels happens to be hidden.
              <Button
                aria-label={__('Create New Topic')}
                className={cn([
                  'bc-w-9 bc-px-0 sm:bc-w-auto sm:bc-px-4 md:bc-px-5',
                  '[&_.ant-btn-icon+span]:bc-ms-0 [&_.ant-btn-icon]:bc-me-0 sm:[&_.ant-btn-icon]:bc-me-1.5'
                ])}
                icon={
                  <LuPlus
                    className="bc-h-[18px] bc-w-[18px] sm:bc-h-4 sm:bc-w-4"
                    strokeLinecap="round"
                    strokeWidth={2.5}
                  />
                }
                onClick={() => setCreateModalOpen(true)}
                shape="round"
                size="middle"
                type="primary"
              >
                <span className="bc-hidden md:bc-inline">{__('Create New Topic')}</span>
                <span className="bc-hidden sm:bc-inline md:bc-hidden">{__('New')}</span>
              </Button>
            )}
            {isLoggedIn && userMenuItems.length > 0 ? (
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                // Tap, not hover, on phones — where there is no hover to speak
                // of and antd's default only works by way of the synthesised
                // mouseenter. It cost the theme row above: the switch runs a
                // view transition, the document goes inert under the finger for
                // its duration, and the mouseleave that follows closed the menu
                // out from under the choice being made. Desktop keeps hover.
                trigger={isMobile ? ['click'] : ['hover']}
              >
                <Button
                  aria-label={__('Account menu')}
                  className="bc-flex bc-items-center bc-gap-0.5 bc-px-2"
                  type="text"
                >
                  <Avatar
                    alt={user?.display_name || user?.username || 'User'}
                    icon={user?.avatar ? undefined : <LuUser />}
                    src={user?.avatar}
                  />
                  <LuChevronDown style={{ fontSize: 16 }} />
                </Button>
              </Dropdown>
            ) : (
              // Signing in is the one thing a logged-out visitor is here to do,
              // so it gets the solid button and registration the quiet one.
              // Both were previously outlined in a hand-rolled blue, which read
              // as two competing primary actions.
              <div className="bc-flex bc-items-center bc-gap-2">
                {customLoginUrl ? (
                  <a className="bc-no-underline" href={customLoginUrl}>
                    <Button icon={<LuLogIn size={16} />} type="primary">
                      {__('Login')}
                    </Button>
                  </a>
                ) : (
                  <Link
                    className="bc-no-underline"
                    to={`/login?redirect_to=${encodeURIComponent(currentPath)}`}
                  >
                    <Button icon={<LuLogIn size={16} />} type="primary">
                      {__('Login')}
                    </Button>
                  </Link>
                )}
                {/* Phones drop the Register button: the bar has to hold the menu,
                    logo, theme toggle and Login, and two auth buttons crowd it.
                    Sign-up stays one tap away via the link on the login page. */}
                {canRegister &&
                  (customRegisterUrl ? (
                    // Custom-URL mode may point sign-up at its own page, which is
                    // not necessarily the login page — so this cannot be folded
                    // into the login branch above.
                    <a className="bc-hidden bc-no-underline md:bc-block" href={customRegisterUrl}>
                      <Button icon={<LuUserPlus size={16} />}>{__('Register')}</Button>
                    </a>
                  ) : (
                    <Link
                      className="bc-hidden bc-no-underline md:bc-block"
                      to={`/register?redirect_to=${encodeURIComponent(currentPath)}`}
                    >
                      <Button icon={<LuUserPlus size={16} />}>{__('Register')}</Button>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
      </header>
      <TopicCreateModal />
      <TopicEditModal />
    </>
  )
}
