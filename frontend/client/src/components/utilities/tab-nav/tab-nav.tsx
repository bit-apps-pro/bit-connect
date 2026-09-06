import { useCallback, useEffect, useRef } from 'react'

import styles from './tab-nav.module.css'

export interface TabItem<K extends string> {
  count?: number
  key: K
  label: string
}

/** How far each arrow key moves the selection within the tablist. */
const ARROW_DELTA: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

/**
 * Breathing room kept between the selected tab and the strip's edge, so it
 * never sits flush and the reader can still see there is more either side.
 */
const EDGE_GAP = 12

/**
 * Underlined tab strip for the profile.
 *
 * Tabs rather than a segmented control: a segment is for a few mutually
 * exclusive views of one thing, and this navigates between six different
 * content sets — one of which ("Manage") is a settings pane rather than a list
 * at all. Tabs also carry no container chrome or per-item pill padding, so six
 * of them fit in far less width.
 *
 * On narrow screens the strip scrolls instead of wrapping, and the selected tab
 * is scrolled into view — so arriving on a deep link like `?tab=manage` shows
 * the tab you are on rather than leaving it off-screen.
 *
 * Arrow-key roving focus follows the WAI-ARIA tabs pattern: arrows move within
 * the tablist, Tab leaves it.
 */
export default function TabNav<K extends string>({
  activeKey,
  ariaLabel,
  idPrefix,
  items,
  onChange
}: {
  activeKey: K
  ariaLabel: string
  /** Namespaces the tab/panel ids so two navs on one page don't collide. */
  idPrefix: string
  items: TabItem<K>[]
  onChange: (key: K) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const alignSelected = useCallback(() => {
    const strip = listRef.current
    const selected = strip?.querySelector<HTMLElement>('[aria-selected="true"]')

    if (!strip || !selected) return

    // Scrolled by hand rather than with scrollIntoView: that lands a few pixels
    // short of the end here, and it can scroll ancestor containers too — the
    // portal body is itself a scroller, so a stray vertical nudge is a real
    // risk. This only ever touches the strip.
    const stripBox = strip.getBoundingClientRect()
    const tabBox = selected.getBoundingClientRect()
    const current = strip.scrollLeft
    let target = current

    if (tabBox.right > stripBox.right - EDGE_GAP) {
      target = current + (tabBox.right - stripBox.right) + EDGE_GAP
    } else if (tabBox.left < stripBox.left + EDGE_GAP) {
      target = current - (stripBox.left - tabBox.left) - EDGE_GAP
    }

    // Clamped, because the first and last tabs can never sit EDGE_GAP from the
    // edge — there is no content past them — and an unclamped target would
    // leave them a few pixels clipped instead of flush.
    target = Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, target))

    // An absolute target, not scrollBy: this effect re-runs when the counts
    // land, which can happen mid-animation. A relative delta measured from an
    // in-flight scroll position compounds and lands short; an absolute one is
    // idempotent and converges on the same place however often it runs.
    if (Math.abs(target - current) > 1) {
      // Instant, not smooth: this runs on mount and again when fonts land, and two
      // overlapping smooth scrolls settle on whichever target was queued first —
      // which left the last tab clipped. Nothing here is a user-initiated scroll.
      strip.scrollTo({ left: target })
    }
  }, [])

  useEffect(() => {
    alignSelected()

    // The strip's geometry keeps moving after this first pass, and each source
    // needs its own trigger:
    //
    //  - the strip itself resizes when a scrollbar appears on an ancestor as
    //    the feed loads (measured: clientWidth 320 -> 313). That shrinks the
    //    scrollable range, so an offset clamped to the old maximum now stops
    //    short. ResizeObserver catches it.
    //  - the tabs resize when Outfit swaps in after first paint (measured:
    //    content 329px -> 480px). The strip's own box may not change, so the
    //    observer stays silent and fonts.ready is what catches it.
    //
    // Without both, the last tab lands a few pixels clipped.
    const observer = new ResizeObserver(() => alignSelected())
    if (listRef.current) observer.observe(listRef.current)

    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) alignSelected()
    })

    return () => {
      cancelled = true
      observer.disconnect()
    }
    // `items` matters as much as `activeKey`: the counts arrive after the first
    // paint and change every tab's width.
  }, [activeKey, items, alignSelected])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = ARROW_DELTA[event.key] ?? 0

    if (delta === 0) return
    event.preventDefault()
    const next = items[(index + delta + items.length) % items.length]
    if (next) onChange(next.key)
  }

  return (
    <div
      aria-label={ariaLabel}
      className={`${styles.scroller} bc-flex bc-gap-1 bc-overflow-x-auto bc-border-0 bc-border-b bc-border-solid bc-border-line`}
      ref={listRef}
      role="tablist"
    >
      {items.map((item, index) => {
        const isActive = item.key === activeKey
        return (
          <button
            aria-controls={`${idPrefix}-panel-${item.key}`}
            aria-selected={isActive}
            className={[
              'bc-relative bc-flex bc-shrink-0 bc-cursor-pointer bc-items-center bc-gap-1.5',
              'bc-border-none bc-bg-transparent bc-px-3 bc-pb-2.5 bc-pt-1.5',
              'bc-text-[13px] bc-font-medium bc-transition-colors',
              isActive ? 'bc-text-ink' : 'bc-text-ink-muted hover:bc-text-ink'
            ].join(' ')}
            id={`${idPrefix}-tab-${item.key}`}
            key={item.key}
            onClick={() => onChange(item.key)}
            onKeyDown={event => onKeyDown(event, index)}
            role="tab"
            // Roving tabindex: only the selected tab is in the tab order.
            tabIndex={isActive ? 0 : -1}
            type="button"
          >
            {item.label}
            {item.count !== undefined && (
              <span className={isActive ? 'bc-text-ink-subtle' : 'bc-text-ink-subtle'}>
                {item.count}
              </span>
            )}
            {/* Sits on top of the container's bottom hairline rather than
                beside it, so the rail stays unbroken. */}
            {isActive && (
              <span
                aria-hidden="true"
                className="bc-absolute bc--bottom-px bc-left-2 bc-right-2 bc-h-0.5 bc-rounded-full bc-bg-primary"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
