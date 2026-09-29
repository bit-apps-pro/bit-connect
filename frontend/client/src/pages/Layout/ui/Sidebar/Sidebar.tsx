import config from '@config/config'
import Promo from '@features/promo'
import useListingSelection from '@pages/Layout/data/use-listing-selection'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import logo from '@resource/img/logo.svg'
import { pickThemedIcon } from '@shared/theme/themed-icon'
import Loop from '@utilities/Loop'
import { isListingPath } from '@utils/listing-path'
import { Grid, Layout } from 'antd'
import { useAtomValue } from 'jotai'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { LuChevronDown, LuX } from 'react-icons/lu'
import { useLocation } from 'react-router'

import { navItemsStore } from '@/store/ssr/nav-items'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import { $isDarkTheme } from '../../../../common/globalStates/$appConfig'
import { cn } from '../../../../common/helpers/globalHelpers'
import { __, sprintf } from '../../../../common/helpers/i18nWrap'
import { listingLink } from './listing-link'
import SidebarNavItem from './SidebarNavItem'

const { Sider } = Layout

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

/**
 * A titled, collapsible group of sider links. The rows hang off a hairline down
 * their left edge, so the group reads as the heading's children rather than as
 * a second list that happens to follow the first.
 */
function NavSection({ children, title }: { children: ReactNode; title: string }) {
  const [isOpen, setIsOpen] = useState(true)
  const listId = useId()

  return (
    <section>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        className={cn([
          'bc-flex bc-w-full bc-cursor-pointer bc-items-center bc-justify-between bc-rounded-md bc-border-none bc-bg-transparent bc-px-0 bc-py-2',
          'bc-text-xs bc-font-semibold bc-uppercase bc-tracking-wider bc-text-ink-muted hover:bc-text-ink',
          'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40'
        ])}
        onClick={() => setIsOpen(open => !open)}
        type="button"
      >
        {title}
        <LuChevronDown
          aria-hidden
          className={cn(['bc-transition-transform bc-duration-200', !isOpen && '-bc-rotate-90'])}
          size={16}
        />
      </button>
      <div
        className="bc-mb-3 bc-mt-1 bc-space-y-1 bc-border-0 bc-border-l bc-border-solid bc-border-line bc-pl-3"
        hidden={!isOpen}
        id={listId}
      >
        {children}
      </div>
    </section>
  )
}

interface NavItem {
  department?: string
  icon?: string
  isActive?: boolean
  label: string
  path: string
  to?: string
}

function NavList({
  className,
  navItems,
  productItems,
  reserveIconSlot
}: {
  className?: string
  navItems: NavItem[]
  productItems: NavItem[]
  reserveIconSlot?: boolean
}) {
  const reserveProductIconSlot = productItems.some(item => !!item.icon)

  return (
    <nav className={cn(['bc-flex bc-w-full bc-flex-col', className])}>
      <NavSection title={__('Stages')}>
        <Loop data={navItems} each="navItems" store={navItemsStore}>
          {(link, key) => <SidebarNavItem key={key} props={{ ...link, reserveIconSlot }} />}
        </Loop>
      </NavSection>

      {productItems.length > 0 && (
        <NavSection title={config.DEPARTMENT_NAMING.plural}>
          {productItems.map(item => (
            <SidebarNavItem
              key={item.path}
              props={{ ...item, reserveIconSlot: reserveProductIconSlot }}
            />
          ))}
        </NavSection>
      )}
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

  // The sidebar is where both halves of the listing are chosen — a stage and a
  // department — so each list's links keep what the other has chosen. See
  // listing-link.ts for the URLs that produces.
  const { pathname } = useLocation()
  const { department: openProduct, stage: namedStage } = useListingSelection()

  // Already in the admin-defined order when the store loads them.
  const navItems = stages.map(stage => ({
    department: openProduct,
    icon: pickThemedIcon(stage.meta, isDarkTheme),
    label: stage.name,
    path: stage.slug
  }))
  // All-or-nothing per list: align the labels once any stage has an icon, and
  // leave the unindented layout untouched for portals that set none.
  const reserveIconSlot = navItems.some(item => !!item.icon)

  // Dropped when an admin switches the department filter off. "All" leads the
  // list so a department can be left again, keeping the stage; it is current
  // only on a listing, the way the stage rows are.
  const departments = useTaxonomiesStoreSelect()?.['bit-connect-departments'] || []
  const productItems: NavItem[] =
    config.PORTAL_FILTERS.product && departments.length > 0
      ? [
          {
            isActive: openProduct === '' && isListingPath(pathname),
            // translators: %s: what the portal calls its departments, plural.
            label: sprintf(__('All %s'), config.DEPARTMENT_NAMING.plural),
            path: '',
            to: listingLink({ stage: namedStage })
          },
          ...departments.map(department => ({
            icon: pickThemedIcon(department.meta, isDarkTheme),
            isActive: department.slug === openProduct,
            label: department.name,
            path: department.slug,
            to: listingLink({ department: department.slug, stage: namedStage })
          }))
        ]
      : []

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
            // Flush with the window's left edge and ruled off from the list on
            // the right; the header's rule closes the top.
            'bc-no-underline bc-p-5 bc-flex bc-h-full bc-flex-col bc-border-0 bc-border-r bc-border-solid bc-border-line bc-bg-surface',
            '[&>.ant-layout-sider-children]:bc-contents'
          ])}
          collapsed={false}
          collapsedWidth={0}
          id="sidebar"
          theme={isDarkTheme ? 'dark' : 'light'}
          width={272}
        >
          {/* flex-1 in place of the old `h-[calc(100%-58px)]`: the credit below
              is a real sibling when it is on, so the nav has to yield its height
              instead of claiming a fixed slice and overlapping it on short
              viewports. Harmless when the credit is off — the nav just gets the
              whole column. */}
          <NavList
            className="scroller thin reveal bc-min-h-0 bc-flex-1 bc-overflow-y-auto"
            navItems={navItems}
            productItems={productItems}
            reserveIconSlot={reserveIconSlot}
          />

          {config.PROMO.enabled && (
            <Promo
              // Top margin only — the gap below now comes from the panel's own
              // padding, so this no longer doubles it.
              className="bc-mt-4 bc-shrink-0"
              eyebrow={config.PROMO.eyebrow}
              headline={config.PROMO.headline}
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
            <NavList
              navItems={navItems}
              productItems={productItems}
              reserveIconSlot={reserveIconSlot}
            />
          </div>

          {config.PROMO.enabled && (
            <Promo
              className="bc-mx-4 bc-mb-4 bc-shrink-0"
              eyebrow={config.PROMO.eyebrow}
              headline={config.PROMO.headline}
              url={config.PROMO.url}
            />
          )}
        </div>
      )}
    </>
  )
}
