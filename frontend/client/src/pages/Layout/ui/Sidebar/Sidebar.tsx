import config from '@config/config'
import Promo from '@features/promo'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import logo from '@resource/img/logo.svg'
import { Grid, Layout } from 'antd'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { LuX } from 'react-icons/lu'

import { $isDarkTheme } from '../../../../common/globalStates/$appConfig'
import { cn } from '../../../../common/helpers/globalHelpers'
import { __ } from '../../../../common/helpers/i18nWrap'
import SidebarPlaces from './sidebar-places'
import SidebarSections from './sidebar-sections'

const { Sider } = Layout

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

/**
 * The portal's own places, then further sections (an add-on's own places)
 * under their own headings.
 */
function NavList({ className }: { className?: string }) {
  return (
    <nav className={cn(['bc-flex bc-w-full bc-flex-col', className])}>
      <SidebarPlaces />
      {SidebarSections && <SidebarSections />}
    </nav>
  )
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const isDarkTheme = useAtomValue($isDarkTheme)
  const fetchStages = useStagesStore(state => state.fetchStages)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  // Read through a ref: the layout passes a new arrow each render, and an
  // effect keyed on it would re-run — and pull focus back to Close — on every
  // render while the drawer is open.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Escape closes the drawer, matching the backdrop tap. Only bound while it is
  // actually open so the portal's other Escape handlers keep working otherwise.
  //
  // It is a modal dialog, so it also behaves like one for the keyboard: focus
  // moves into it on open (left behind, it sat on "Open menu" under the
  // backdrop), Tab cycles inside it, and closing hands focus back to whatever
  // opened it.
  useEffect(() => {
    if (!isMobile || !isOpen) return

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    // After a beat, not at once: visibility is part of the slide-in
    // transition, and at its first instant the panel still computes as
    // hidden, which a focus() call silently ignores.
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 50)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !drawerRef.current) return

      const focusable = [
        ...drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ]
      const first = focusable.at(0)
      const last = focusable.at(-1)

      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      opener?.focus()
    }
  }, [isMobile, isOpen])

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
            // No right padding: the nav takes the whole gutter as its own
            // `bc-pr-5`, so its scrollbar runs flush against the panel's right
            // rule with the gap before the items, instead of floating inside.
            'bc-no-underline bc-py-5 bc-pl-5 bc-pr-0 bc-flex bc-h-full bc-flex-col bc-border-0 bc-border-r bc-border-solid bc-border-line bc-bg-surface',
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
          <NavList className="scroller thin reveal bc-min-h-0 bc-flex-1 bc-overflow-y-auto bc-pr-5" />

          {config.PROMO.enabled && (
            <Promo
              // Top margin only — the gap below now comes from the panel's own
              // padding, so this no longer doubles it.
              // `bc-mr-5` restores the right inset the panel gave to the nav;
              // `bc-pl-2.5` is the rows' own padding, so the credit starts
              // on the same line as their icons.
              className="bc-mt-4 bc-mr-5 bc-pl-2.5 bc-shrink-0"
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
          ref={drawerRef}
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
              ref={closeButtonRef}
              type="button"
            >
              <LuX size={18} />
            </button>
          </div>
          <div className="bc-mx-4 bc-shrink-0 bc-border-0 bc-border-b bc-border-solid bc-border-line" />
          <div className="bc-min-h-0 bc-flex-1 bc-overflow-y-auto bc-px-3 bc-py-3">
            <NavList />
          </div>

          {config.PROMO.enabled && (
            <Promo
              // The list's `bc-px-3` plus the rows' own padding, so the credit
              // lines up with their icons.
              className="bc-mx-3 bc-mb-4 bc-pl-2.5 bc-shrink-0"
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
