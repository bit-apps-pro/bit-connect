import ThemeToggle from '@components/utilities/theme-toggle'
import config from '@config/config'
import { Layout, Typography } from 'antd'
import { useAtomValue } from 'jotai'
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
 * here is forum_manage except the two moderation screens. Without the split, a
 * moderator holding only forum_moderate would see a settings menu they cannot
 * open, and an administrator without forum_moderate would see a queue that
 * refuses them.
 */
const navItems: { label: string; path: string; requires: 'manage' | 'moderate' }[] = [
  { label: __('Dashboard'), path: '../', requires: 'manage' },
  { label: __('General'), path: '../general', requires: 'manage' },
  { label: __('Stages'), path: '../stages', requires: 'manage' },
  { label: __('Topic Types'), path: '../topic-types', requires: 'manage' },
  { label: __('Products'), path: '../products', requires: 'manage' },
  { label: __('Tags'), path: '../tags', requires: 'manage' },
  { label: __('Status'), path: '../status', requires: 'manage' },
  { label: __('Manager'), path: '../manager', requires: 'manage' },
  // Ordered to match the WordPress menu, so the two navs read the same way.
  { label: __('Activity'), path: '../activity', requires: 'moderate' },
  { label: __('Reports'), path: '../reports', requires: 'moderate' },
  { label: __('Notifications'), path: '../notifications', requires: 'manage' },
  { label: __('SEO'), path: '../seo', requires: 'manage' },
  { label: __('Settings'), path: '../settings', requires: 'manage' },
  // Last, and forum_manage: licensing is an administrative act, and it is the
  // one screen here that is about the plugin rather than about the forum.
  { label: __('License & Support'), path: '../license', requires: 'manage' }
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
        'bc-px-4 bc-flex bc-h-full bc-flex-col bc-justify-center bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface',
        '[&>.ant-layout-sider-children]:bc-contents'
      ])}
      collapsed={false}
      collapsedWidth={0}
      id="sidebar"
      theme={isDarkTheme ? 'dark' : 'light'}
      width={250}
    >
      <Link
        className="bc-mx-1 bc-my-2 bc-flex bc-items-center bc-justify-center bc-gap-2"
        title={__('Bit Connect')}
        to="../license"
      >
        <Typography.Title level={3}>{__('Bit Connect')}</Typography.Title>
      </Link>

      <nav
        className={cn([
          'bc-mt-1 bc-flex bc-h-[calc(100%-58px)] bc-w-full bc-flex-col bc-justify-between'
        ])}
      >
        <div className="bc-space-y-1">
          {visibleNavItems.map(link => (
            <SidebarNavItem key={link.label} props={link} />
          ))}
        </div>

        <div>
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
