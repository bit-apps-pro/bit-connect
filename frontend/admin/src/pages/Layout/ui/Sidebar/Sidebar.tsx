import ThemeToggle from '@components/utilities/theme-toggle'
import config from '@config/config'
import logo from '@resource/img/logo.svg'
import { Grid, Layout } from 'antd'
import { useAtomValue } from 'jotai'
import { Fragment } from 'react'
import { type IconType } from 'react-icons'
import {
  LuChartLine,
  LuChartNoAxesColumn,
  LuCircleCheck,
  LuHash,
  LuLayoutGrid,
  LuLifeBuoy,
  LuListFilter,
  LuMessagesSquare,
  LuSettings,
  LuTag,
  LuUsers
} from 'react-icons/lu'
import { Link } from 'react-router'

import { $isDarkTheme } from '../../../../common/globalStates/$appConfig'
import { cn } from '../../../../common/helpers/globalHelpers'
import { __ } from '../../../../common/helpers/i18nWrap'
import useAddedPages from '../../../use-added-pages'
import SidebarNavItem from './SidebarNavItem'

const { Sider } = Layout

/**
 * The nav, in the groups an admin reaches for them: the forum's daily work
 * first, then how topics are sorted, then settings. A thin rule divides one
 * group from the next — a rule rather than a heading, since the WordPress
 * menu, which lists the same screens in the same order, can draw no heading.
 *
 * Each entry names the capability its screen answers to, so the nav offers
 * nothing that would only 403 on arrival. Mirrors Menu.php, which gates the
 * WordPress menu the same way: Topics, Reports and Activity are
 * bit_connect_forum_moderate, the work a moderator does; everything else is
 * bit_connect_forum_manage. Without the split, a moderator holding only
 * bit_connect_forum_moderate would see a settings menu they cannot open, and an
 * administrator without bit_connect_forum_moderate would see a queue that
 * refuses them.
 */
interface NavItem {
  group: 'community' | 'home' | 'organize' | 'settings'
  icon: IconType
  label: string
  path: string
  requires: 'manage' | 'moderate'
}

const navItems: NavItem[] = [
  { group: 'home', icon: LuLayoutGrid, label: __('Dashboard'), path: '../', requires: 'manage' },
  { group: 'community', icon: LuMessagesSquare, label: __('Topics'), path: '../topics', requires: 'moderate' },
  { group: 'community', icon: LuChartLine, label: __('Reports'), path: '../reports', requires: 'moderate' },
  { group: 'community', icon: LuListFilter, label: __('Activity'), path: '../activity', requires: 'moderate' },
  { group: 'community', icon: LuUsers, label: __('Members'), path: '../manager', requires: 'manage' },
  { group: 'organize', icon: LuHash, label: __('Topic Types'), path: '../topic-types', requires: 'manage' },
  { group: 'organize', icon: LuChartNoAxesColumn, label: __('Stages'), path: '../stages', requires: 'manage' },
  { group: 'organize', icon: LuCircleCheck, label: __('Statuses'), path: '../status', requires: 'manage' },
  { group: 'organize', icon: LuTag, label: __('Tags'), path: '../tags', requires: 'manage' },
  { group: 'settings', icon: LuSettings, label: __('Settings'), path: '../settings', requires: 'manage' },
  // Last: it is the one screen here that is about the plugin rather than
  // about the forum.
  { group: 'settings', icon: LuLifeBuoy, label: __('Support'), path: '../support', requires: 'manage' }
]

export default function Sidebar() {
  const isDarkTheme = useAtomValue($isDarkTheme)
  const addedPages = useAddedPages()
  // Each added screen goes in after the one it names, or last when that one is
  // not here. It joins that screen's group.
  const allNavItems = addedPages.reduce((items, page) => {
    const index = items.findIndex(item => item.path === `../${page.after}`)
    const entry: NavItem = {
      group: index === -1 ? 'settings' : items[index].group,
      icon: page.icon,
      label: page.label,
      path: `../${page.path}`,
      requires: page.requires
    }

    return index === -1 ? [...items, entry] : [...items.slice(0, index + 1), entry, ...items.slice(index + 1)]
  }, navItems)
  const visibleNavItems = allNavItems.filter(item =>
    item.requires === 'moderate' ? config.CAN_MODERATE : config.CAN_MANAGE
  )
  // An icon rail below md. At 220px the full column took more than half a
  // phone's width, and every screen beside it broke its headings mid-word.
  // Switched in JS rather than with `md:` classes, which lose to the base
  // utilities in this app's layered stylesheet. `false`, not falsy: the first
  // render has no breakpoints yet and keeps the full column.
  const compact = Grid.useBreakpoint().md === false

  return (
    <Sider
      className={cn([
        // bc-bg-surface (over the Sider theme's own paint) keeps the panel on
        // the same neutral scale as the content area — antd's dark Sider is
        // navy, which read as a second colour scheme inside the same screen.
        // Overflow is clipped at the card edge, so on a short viewport the
        // nav scrolls inside it rather than spilling past it.
        // Flush with the frame, divided from the content by one rule rather
        // than floated as a second card.
        compact ? 'bc-px-2' : 'bc-px-3',
        'bc-flex bc-h-full bc-flex-col bc-overflow-hidden bc-border-0 bc-border-r bc-border-solid bc-border-line bc-bg-surface',
        '[&>.ant-layout-sider-children]:bc-contents'
      ])}
      collapsed={false}
      collapsedWidth={0}
      id="sidebar"
      theme={isDarkTheme ? 'dark' : 'light'}
      width={compact ? 56 : 220}
    >
      <Link
        aria-label={__('Bit Connect')}
        className="bc-mx-1 bc-mb-3 bc-mt-4 bc-flex bc-items-center bc-gap-2 bc-text-ink hover:bc-text-ink"
        title={__('Bit Connect')}
        to="../"
      >
        <img alt="" className="bc-size-7 bc-shrink-0" src={logo} />
        {!compact && <span className="bc-text-lg bc-font-semibold">{__('Bit Connect')}</span>}
      </Link>

      {/* The list grows to fill the column instead of claiming a set slice of
          it: the theme toggle and credit are real siblings, so on a short
          viewport the list yields height and scrolls rather than pushing them
          out of the card. Same shape as the client sidebar. */}
      <nav className="bc-mt-1 bc-flex bc-min-h-0 bc-w-full bc-flex-1 bc-flex-col bc-justify-between">
        <div className="scroller thin reveal bc-min-h-0 bc-flex-1 bc-space-y-0.5 bc-overflow-y-auto">
          {visibleNavItems.map((link, index) => (
            <Fragment key={link.path}>
              {index > 0 && visibleNavItems[index - 1].group !== link.group && (
                <hr className="bc-mx-2 bc-my-2 bc-border-0 bc-border-t bc-border-solid bc-border-line" />
              )}
              <SidebarNavItem iconOnly={compact} props={link} />
            </Fragment>
          ))}
        </div>

        {/* On the rail, the theme control is its own menu button and the
            credit — a line of text with nowhere to fit — is left out. */}
        <div className="bc-flex bc-shrink-0 bc-flex-col bc-items-center bc-pb-2 bc-pt-2">
          <ThemeToggle block={!compact} />

          {!compact && (
            <a
              className="bc-my-1 bc-block bc-text-center bc-text-xs bc-text-ink-subtle hover:bc-text-blue-500 hover:bc-underline"
              href="https://bitapps.pro"
              rel="noreferrer noopener nofollow"
              target="_blank"
            >
              {__('Product by Bit Apps')}
            </a>
          )}
        </div>
      </nav>
    </Sider>
  )
}
