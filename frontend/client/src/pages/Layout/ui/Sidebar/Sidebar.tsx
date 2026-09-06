import config from '@config/config'
import Promo from '@features/promo'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import logo from '@resource/img/logo.svg'
import { pickThemedIcon } from '@shared/theme/themed-icon'
import Loop from '@utilities/Loop'
import { Grid, Layout } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { LuX } from 'react-icons/lu'

import { navItemsStore } from '@/store/ssr/nav-items'

import { $isDarkTheme } from '../../../../common/globalStates/$appConfig'
import { cn } from '../../../../common/helpers/globalHelpers'
import { __ } from '../../../../common/helpers/i18nWrap'
import SidebarNavItem from './SidebarNavItem'

const { Sider } = Layout

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

function NavList({
  className,
  navItems,
  reserveIconSlot
}: {
  className?: string
  navItems: { icon?: string; label: string; path: string }[]
  reserveIconSlot?: boolean
}) {
  return (
    <nav className={cn(['bc-flex bc-w-full bc-flex-col bc-justify-between', className])}>
      <div className="bc-space-y-1">
        <Loop data={navItems} each="navItems" store={navItemsStore}>
          {(link, key) => <SidebarNavItem key={key} props={{ ...link, reserveIconSlot }} />}
        </Loop>
      </div>
    </nav>
  )
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const isDarkTheme = useAtomValue($isDarkTheme)
  const { fetchStages, stages } = useStagesStore()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  // Escape closes the drawer, matching the backdrop tap. Only bound while it is
  // actually open so the portal's other Escape handlers keep working otherwise.
  useEffect(() => {
    if (!isMobile || !isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMobile, isOpen, onClose])

  // Already in the admin-defined order when the store loads them.
  const navItems = stages.map(stage => ({
    icon: pickThemedIcon(stage.meta, isDarkTheme),
    label: stage.name,
    path: stage.slug
  }))
  // All-or-nothing per list: align the labels once any stage has an icon, and
  // leave the unindented layout untouched for portals that set none.
  const reserveIconSlot = navItems.some(item => !!item.icon)

  return (
    <>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sider
          className={cn([
            // `bc-p-4`, not `bc-px-4`: the panel padded its sides by 16px but
            // left the top to the nav's own `bc-mt-1`, so the first item —
            // usually the active, highlighted one — sat 4px from the card's edge
            // and read as pinned to it. Padding all four sides here also gives
            // the list a bottom gutter when the promo credit is switched off,
            // which the old rule left to `Promo`'s margin and lost with it.
            // `bc-justify-center` is gone with it: NavList takes `bc-flex-1`, so
            // there was never free space on the cross axis to distribute.
            'bc-no-underline bc-p-4 bc-flex bc-h-full bc-flex-col bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface',
            '[&>.ant-layout-sider-children]:bc-contents'
          ])}
          collapsed={false}
          collapsedWidth={0}
          id="sidebar"
          theme={isDarkTheme ? 'dark' : 'light'}
          width={250}
        >
          {/* flex-1 in place of the old `h-[calc(100%-58px)]`: the credit below
              is a real sibling when it is on, so the nav has to yield its height
              instead of claiming a fixed slice and overlapping it on short
              viewports. Harmless when the credit is off — the nav just gets the
              whole column. */}
          <NavList
            className="scroller thin bc-min-h-0 bc-flex-1 bc-overflow-y-auto"
            navItems={navItems}
            reserveIconSlot={reserveIconSlot}
          />

          {config.PROMO.enabled && (
            <Promo
              // Top margin only — the gap below now comes from the panel's own
              // padding, so this no longer doubles it.
              className="bc-mt-4 bc-shrink-0"
              cta={config.PROMO.cta}
              eyebrow={config.PROMO.eyebrow}
              headline={config.PROMO.headline}
              phrases={config.PROMO.phrases}
              prefix={config.PROMO.prefix}
              url={config.PROMO.url}
            />
          )}
        </Sider>
      )}

      {/* Mobile backdrop */}
      {isMobile && (
        <div
          aria-hidden="true"
          className={cn([
            'bc-fixed bc-inset-0 bc-z-40 bc-bg-black/50 bc-backdrop-blur-sm',
            'bc-transition-opacity bc-duration-300 bc-ease-out',
            isOpen ? 'bc-opacity-100 bc-pointer-events-auto' : 'bc-opacity-0 bc-pointer-events-none'
          ])}
          onClick={onClose}
        />
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <div
          aria-label={__('Main navigation')}
          aria-modal={isOpen}
          className={cn([
            // Width leaves a usable strip of backdrop to tap-to-dismiss; at 90vw
            // that strip was ~39px on a 390px phone, too small to hit reliably.
            'bc-fixed bc-left-0 bc-top-0 bc-z-50 bc-flex bc-w-[min(19rem,82vw)] bc-flex-col',
            // `bc-h-screen` is 100vh, the *large* viewport — measured as though
            // the browser's own chrome were hidden. On Chrome/Brave for Android,
            // and on iOS Safari with the address bar moved to the bottom, that
            // runs the drawer past what the visitor can actually see; the promo
            // credit is pinned to its bottom edge and nothing here scrolls, so
            // the credit's link sat under the URL bar and could not be reached.
            // 100dvh tracks that bar as it shows and hides.
            //
            // Both, rather than dvh alone: the 100vh rule stays as the fallback
            // for browsers without dvh (Safari < 15.4), where a lone dvh height
            // would be dropped as invalid and leave the drawer at content height
            // — a far worse break than the one being fixed. The @supports block
            // Tailwind emits sorts after the plain utility, so it wins wherever
            // dvh is understood.
            'bc-h-screen supports-[height:100dvh]:bc-h-[100dvh]',
            // Separate from dvh, which does not account for the home indicator.
            'bc-pb-[env(safe-area-inset-bottom)]',
            // Opaque, not `bc-bg-surface/95`: the semantic tokens resolve to bare
            // `var(--bc-*)` values, which Tailwind cannot compose an alpha
            // modifier onto — it drops the declaration and the panel renders
            // fully transparent. Only literal-hex colours (primary) take `/NN`.
            'bc-bg-surface bc-rounded-r-lg bc-shadow-2xl',
            // Visibility is in the transition so it flips only once the panel has
            // slid away, which keeps the closed drawer out of the tab order and
            // the accessibility tree without cutting the animation short.
            'bc-transition-[transform,visibility] bc-duration-300 bc-ease-out',
            isOpen ? 'bc-visible bc-translate-x-0' : 'bc-invisible -bc-translate-x-full'
          ])}
          role="dialog"
        >
          <div className="bc-flex bc-shrink-0 bc-items-center bc-justify-between bc-gap-2 bc-px-4 bc-pb-3 bc-pt-4">
            {/* The mobile header hides the community name to save width, so the
                drawer is the one place it stays legible on a phone. */}
            <div className="bc-flex bc-min-w-0 bc-items-center bc-gap-2">
              <img
                alt=""
                className="bc-h-7 bc-w-7 bc-shrink-0 bc-object-contain"
                src={config.LOGO_LIGHT || logo}
              />
              <span className="bc-truncate bc-font-semibold bc-text-base bc-text-ink">
                {config.COMMUNITY_TITLE || config.PRODUCT_NAME}
              </span>
            </div>
            <button
              aria-label={__('Close menu')}
              className={cn([
                'bc-flex bc-h-9 bc-w-9 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center',
                'bc-rounded-full bc-border-none bc-bg-transparent bc-text-ink-muted',
                'hover:bc-bg-surface-hover hover:bc-text-ink bc-transition-colors'
              ])}
              onClick={onClose}
              type="button"
            >
              <LuX size={18} />
            </button>
          </div>
          <div className="bc-mx-4 bc-shrink-0 bc-border-0 bc-border-b bc-border-solid bc-border-line" />
          <div className="bc-min-h-0 bc-flex-1 bc-overflow-y-auto bc-px-3 bc-py-3">
            <NavList navItems={navItems} reserveIconSlot={reserveIconSlot} />
          </div>

          {config.PROMO.enabled && (
            <Promo
              className="bc-mx-3 bc-mb-4 bc-shrink-0"
              cta={config.PROMO.cta}
              eyebrow={config.PROMO.eyebrow}
              headline={config.PROMO.headline}
              phrases={config.PROMO.phrases}
              prefix={config.PROMO.prefix}
              url={config.PROMO.url}
            />
          )}
        </div>
      )}
    </>
  )
}
