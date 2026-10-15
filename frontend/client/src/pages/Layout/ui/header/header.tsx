import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import useCapabilityGate from '@common/hooks/useCapabilityGate'
import config from '@config/config'
import { NotificationBell } from '@features/notifications'
import useTopicModalStore from '@features/topic-modal/state/use-topic-modal-store'
import TopicModals from '@features/topic-modal/ui/topic-modals'
import logo from '@resource/img/logo.svg'
import SearchInput from '@utilities/search-input'
import ThemeToggle from '@utilities/theme-toggle'
import { userProfilePath } from '@utilities/user-link'
import { externalLoginUrl, externalRegisterUrl, registrationIsOffered } from '@utils/auth-urls'
import { isListingPath } from '@utils/listing-path'
import { routePath } from '@utils/route-path'
import { Avatar, Button, Dropdown, Grid } from 'antd'
import { useEffect, useState } from 'react'
import {
  LuChevronDown,
  LuLogIn,
  LuLogOut,
  LuMenu,
  LuPlus,
  LuSearch,
  LuUser,
  LuUserPlus,
  LuX
} from 'react-icons/lu'
import { Link, useLocation, useSearchParams } from 'react-router'

import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'

interface HeaderProps {
  /** True once content has scrolled beneath the bar; drawn by Layout. */
  isScrolled?: boolean
  onMenuOpen?: () => void
}

export default function Header({ isScrolled = false, onMenuOpen }: HeaderProps) {
  const { setCreateModalOpen } = useTopicModalStore()
  const canAct = useCapabilityGate()
  const location = useLocation()
  const { can, checkAuth, isLoggedIn, logout, user } = useAuthStore()
  // The server refuses the topic anyway; a button that only ever answers
  // "not authorized" is worse than no button.
  const canCreatePost = can('bit_connect_forum_create_post')
  const { fetchSettings } = useAdminSettingsStore()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Phones fold the search into a button that opens a row under the bar. A
  // results page keeps the row open, so the term being shown stays on screen.
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(false)
  // The root list, or an archive (a board, a tag) searched inside.
  const showingResults = isListingPath(location.pathname) && !!searchParams.get('search')
  const searchRowOpen = isMobile && (searchOpen || showingResults)

  // Closing the row on a results page ends the search too: the row is held
  // open by it, and a hidden term would still be narrowing the list.
  const toggleSearch = () => {
    if (!searchRowOpen) {
      setSearchOpen(true)
      return
    }
    setSearchOpen(false)
    if (showingResults) {
      setSearchParams(
        prev => {
          prev.delete('search')
          if (prev.has('page')) prev.set('page', '1')
          return prev
        },
        { replace: true }
      )
    }
  }

  useEffect(() => {
    fetchSettings().catch(console.error)
  }, [fetchSettings])

  useEffect(() => {
    if (!isLoggedIn || !user) {
      checkAuth()
    }
  }, [checkAuth, isLoggedIn, user])

  const openCreate = () => {
    if (canAct('bit_connect_forum_create_post')) setCreateModalOpen(true)
  }

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
              // A childless group, like the theme row below: a `disabled` item
              // greyed the member's own name out to low contrast and announced
              // it as an action that cannot be taken.
              {
                children: [],
                key: 'account',
                label: (
                  <div className="bc-py-1">
                    <div className="bc-font-semibold bc-text-ink">{user.display_name || user.username}</div>
                    <div className="bc-text-xs bc-text-ink-muted">{user.email}</div>
                  </div>
                ),
                type: 'group' as const
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
        // The theme control lives here for anyone logged in — the header
        // renders none for them — last and behind a divider, because a display
        // preference belongs under the account actions, not among them.
        //
        // A childless `group` rather than a `disabled` item, though both render
        // an inert row: the pill owns its own clicks and needs the menu to stay
        // open across a choice, and only a group is inert without claiming so —
        // `disabled` would hang `aria-disabled` over a live three-way switch.
        // A group title is not a menuitem, so rc-menu never fires the click
        // that closes the dropdown, and the radios keep their own semantics.
        { type: 'divider' as const },
        {
          children: [],
          key: 'theme',
          label: <ThemeToggle block />,
          type: 'group' as const
        }
      ]
    : []

  // Logo + title. On phones the title truncates to one line (and is a touch
  // smaller) instead of wrapping; desktop keeps the xl size via md:.
  const brand = (
    <>
      <img
        alt={`${config.COMMUNITY_TITLE || config.PRODUCT_NAME} logo`}
        className="bc-h-8 bc-w-8 bc-shrink-0 bc-object-contain md:bc-h-9 md:bc-w-9"
        src={config.LOGO_LIGHT || logo}
      />
      <span className="bc-hidden bc-truncate bc-font-bold bc-text-lg bc-text-ink md:bc-inline md:bc-text-2xl">
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
        // From md the rule is there at rest too: the sider's own rule runs up
        // into it, and a T-junction with one arm missing reads as a gap.
        className={cn([
          'bc-sticky bc-top-0 bc-z-20 bc-border-0 bc-border-b bc-border-solid bc-bg-surface bc-px-4 bc-py-3 md:bc-px-7 md:bc-py-5',
          'bc-transition-colors bc-duration-200',
          isScrolled ? 'bc-border-line' : 'bc-border-transparent md:bc-border-line'
        ])}
      >
        <div className="bc-flex bc-items-center bc-justify-between bc-gap-4">
          <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2 md:bc-flex-1 md:bc-basis-0">
            {isMobile && (
              <Button
                aria-label={__('Open menu')}
                // Pulled out by its own padding, like the Back button below, so
                // the glyph lines up with the page gutter rather than 8px in.
                className="bc--ml-2 bc-shrink-0"
                // Sized with the bell at the other end of the bar, so the two
                // icons that frame it read at one size. A touch heavier than
                // Lucide's 2px: three bare lines carry less ink than the bell's
                // outline, and at the same stroke looked the lighter of the
                // two. Round caps because every other icon in the bar has them
                // — Lucide's default — and square ends on the one hand-tuned
                // icon showed.
                icon={<LuMenu size={24} strokeLinecap="round" strokeWidth={2.25} />}
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
          {/* Centred between the brand and the account controls, which share
              the remaining width equally so the field sits on the page's axis
              whatever either side holds. */}
          {!isMobile && <SearchInput className="bc-min-w-0 bc-max-w-[560px] bc-flex-[1.4]" withShortcut />}
          <div className="bc-flex bc-shrink-0 bc-items-center bc-justify-end bc-gap-1 md:bc-flex-1 md:bc-basis-0">
            {isMobile && (
              // Stays the magnifier while the row is open — tinted, so it reads
              // as the control that row belongs to. Closing is the × at the
              // field's end, where the eye already is.
              <Button
                aria-expanded={searchRowOpen}
                aria-label={__('Search topics')}
                className={searchRowOpen ? 'bc-text-primary' : undefined}
                icon={<LuSearch size={22} strokeLinecap="round" strokeWidth={2.25} />}
                onClick={toggleSearch}
                type="text"
              />
            )}
            {/* Guests only: logged in, the control sits in the account menu.
                Logged out — most of the portal's traffic — there is no account
                menu to hold it, so it stays in the bar, phone-width button and
                all. */}
            {!isLoggedIn && <ThemeToggle />}
            {/* Logged-in only, like Create below it: a guest has no
                notifications, and an empty bell invites a click that can only
                disappoint. */}
            {isLoggedIn && <NotificationBell />}
            {isLoggedIn && canCreatePost && (
              <>
                {/* The label steps up with the room to hold it: "New" on a
                    wide phone, the whole sentence on desktop. Sized to the
                    bar's 36px bell and menu button so it joins their rhythm
                    instead of being the widest object on the row with the
                    least room.

                    Drawn as the list's own Create button
                    (pages/topics/topics.tsx) at the bar's height: the same
                    10px corners, 18px plus and 8px gap, so the one action reads
                    as one button whichever page offers it.

                    The glyph's heavier stroke is the menu button's trick —
                    Lucide draws 2px at every size, so a glyph thins out as it
                    grows. */}
                <Button
                  aria-label={__('Create New Topic')}
                  className="bc-hidden sm:bc-inline-flex sm:bc-rounded-[10px] sm:bc-px-4 md:bc-px-5"
                  icon={<LuPlus size={18} strokeLinecap="round" strokeWidth={2.5} />}
                  onClick={openCreate}
                  size="middle"
                  type="primary"
                >
                  <span className="bc-hidden md:bc-inline">{__('Create New Topic')}</span>
                  <span className="bc-hidden sm:bc-inline md:bc-hidden">{__('New')}</span>
                </Button>

                {/* Phones: a floating button in the thumb's reach instead of a
                    disc in the bar, which shared the narrowest row on the
                    screen with the logo, bell and account menu. Fixed to the
                    viewport — the header is sticky, not transformed, so it is
                    no containing block — and lifted clear of the home
                    indicator. Below the sidebar drawer (z-40), which covers
                    it while open. */}
                <Button
                  aria-label={__('Create New Topic')}
                  className="bc-fixed bc-bottom-[calc(1rem+env(safe-area-inset-bottom))] bc-right-4 bc-z-30 bc-h-14 bc-w-14 bc-rounded-[14px] bc-shadow-lg sm:bc-hidden"
                  icon={<LuPlus size={26} strokeLinecap="round" strokeWidth={2.5} />}
                  onClick={openCreate}
                  type="primary"
                />
              </>
            )}
            {isLoggedIn && userMenuItems.length > 0 ? (
              <Dropdown
                menu={{ items: userMenuItems }}
                placement="bottomRight"
                // Click, not hover, at every width: the theme row switches via a
                // view transition, the document goes inert under the pointer
                // for its duration, and the mouseleave that follows closed a
                // hover menu out from under the choice being made.
                trigger={['click']}
              >
                <Button
                  aria-label={__('Account menu')}
                  className="bc-flex bc-items-center bc-gap-0.5 bc-px-1 md:bc-px-2"
                  type="text"
                >
                  <Avatar
                    alt={user?.display_name || user?.username || 'User'}
                    icon={user?.avatar ? undefined : <LuUser />}
                    size={34}
                    src={user?.avatar}
                  />
                  <LuChevronDown size={18} strokeLinecap="round" strokeWidth={2.5} />
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
                    to={routePath(`/login?redirect_to=${encodeURIComponent(currentPath)}`)}
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
                      to={routePath(`/register?redirect_to=${encodeURIComponent(currentPath)}`)}
                    >
                      <Button icon={<LuUserPlus size={16} />}>{__('Register')}</Button>
                    </Link>
                  ))}
              </div>
            )}
          </div>
        </div>
        {searchRowOpen && (
          <div className="bc-mt-3 bc-flex bc-items-center bc-gap-1">
            <SearchInput className="bc-min-w-0 bc-flex-1" focusOnMount={searchOpen} onDismiss={() => setSearchOpen(false)} />
            <Button
              aria-label={__('Close search')}
              className="bc-shrink-0"
              icon={<LuX size={22} strokeLinecap="round" strokeWidth={2.25} />}
              onClick={toggleSearch}
              type="text"
            />
          </div>
        )}
      </header>
      <TopicModals />
    </>
  )
}
