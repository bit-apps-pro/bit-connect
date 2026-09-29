import ThemeToggle from '@components/utilities/theme-toggle'
import config from '@config/config'
import logo from '@resource/img/logo.svg'
import { Layout } from 'antd'
import { useAtomValue } from 'jotai'
import { type IconType } from 'react-icons'
import {
  LuBell,
  LuChartLine,
  LuChartNoAxesColumn,
  LuCircleCheck,
  LuHash,
  LuLayers,
  LuLayoutGrid,
  LuLifeBuoy,
  LuListFilter,
  LuSettings,
  LuSlidersHorizontal,
  LuTag,
  LuTrendingUp,
  LuUsers
} from 'react-icons/lu'
import { Link } from 'react-router'

import { $isDarkTheme } from '../../../../common/globalStates/$appConfig'
import { cn } from '../../../../common/helpers/globalHelpers'
import { __ } from '../../../../common/helpers/i18nWrap'
import SidebarNavItem from './SidebarNavItem'

const { Sider } = Layout

/**
 * Which capability a screen answers to, so the nav offers nothing that would
 * only 403 on arrival.
 *
 * Mirrors Menu.php, which gates the WordPress menu the same way: everything
 * here is bit_connect_forum_manage except the two moderation screens. Without the split, a
 * moderator holding only bit_connect_forum_moderate would see a settings menu they cannot
 * open, and an administrator without bit_connect_forum_moderate would see a queue that
 * refuses them.
 */
const navItems: {
  icon: IconType
  label: string
  path: string
  requires: 'manage' | 'moderate'
}[] = [
  { icon: LuLayoutGrid, label: __('Dashboard'), path: '../', requires: 'manage' },
  { icon: LuSlidersHorizontal, label: __('General'), path: '../general', requires: 'manage' },
  { icon: LuChartNoAxesColumn, label: __('Stages'), path: '../stages', requires: 'manage' },
  { icon: LuHash, label: __('Topic Types'), path: '../topic-types', requires: 'manage' },
  { icon: LuLayers, label: __('Products'), path: '../products', requires: 'manage' },
  { icon: LuTag, label: __('Tags'), path: '../tags', requires: 'manage' },
  { icon: LuCircleCheck, label: __('Status'), path: '../status', requires: 'manage' },
  { icon: LuUsers, label: __('Manager'), path: '../manager', requires: 'manage' },
  // Ordered to match the WordPress menu, so the two navs read the same way.
  { icon: LuListFilter, label: __('Activity'), path: '../activity', requires: 'moderate' },
  { icon: LuChartLine, label: __('Reports'), path: '../reports', requires: 'moderate' },
  { icon: LuBell, label: __('Notifications'), path: '../notifications', requires: 'manage' },
  { icon: LuTrendingUp, label: __('SEO'), path: '../seo', requires: 'manage' },
  { icon: LuSettings, label: __('Settings'), path: '../settings', requires: 'manage' },
  // Last, and bit_connect_forum_manage: it is the one screen here that is about the plugin
  // rather than about the forum.
  { icon: LuLifeBuoy, label: __('Support'), path: '../support', requires: 'manage' }
]

export default function Sidebar() {
  const isDarkTheme = useAtomValue($isDarkTheme)
  const visibleNavItems = navItems.filter(item =>
    item.requires === 'moderate' ? config.CAN_MODERATE : config.CAN_MANAGE
  )

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
        'bc-px-3 bc-flex bc-h-full bc-flex-col bc-overflow-hidden bc-border-0 bc-border-r bc-border-solid bc-border-line bc-bg-surface',
        '[&>.ant-layout-sider-children]:bc-contents'
      ])}
      collapsed={false}
      collapsedWidth={0}
      id="sidebar"
      theme={isDarkTheme ? 'dark' : 'light'}
      width={220}
    >
      <Link
        className="bc-mx-1 bc-mb-3 bc-mt-4 bc-flex bc-items-center bc-gap-2 bc-text-ink hover:bc-text-ink"
        title={__('Bit Connect')}
        to="../support"
      >
        <img alt="" className="bc-size-7 bc-shrink-0" src={logo} />
        <span className="bc-text-lg bc-font-semibold">{__('Bit Connect')}</span>
      </Link>

      {/* The list grows to fill the column instead of claiming a set slice of
          it: the theme toggle and credit are real siblings, so on a short
          viewport the list yields height and scrolls rather than pushing them
          out of the card. Same shape as the client sidebar. */}
      <nav className="bc-mt-1 bc-flex bc-min-h-0 bc-w-full bc-flex-1 bc-flex-col bc-justify-between">
        <div className="scroller thin bc-min-h-0 bc-flex-1 bc-space-y-0.5 bc-overflow-y-auto">
          {visibleNavItems.map(link => (
            <SidebarNavItem key={link.label} props={link} />
          ))}
        </div>

        <div className="bc-shrink-0 bc-pb-2 bc-pt-2">
          <ThemeToggle block />

          <a
            className="bc-my-1 bc-block bc-text-center bc-text-xs bc-text-ink-subtle hover:bc-text-blue-500 hover:bc-underline"
            href="https://bitapps.pro"
            rel="noreferrer noopener nofollow"
            target="_blank"
          >
            {__('Product by Bit Apps')}
          </a>
        </div>
      </nav>
    </Sider>
  )
}
