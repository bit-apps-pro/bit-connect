import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

/** Width of the fade that marks a strip edge with more chips past it. */
const FADE = '2rem'

/**
 * The topic types as a row of chips — All first, then each type in the admin's
 * order. One is always pressed, so the row doubles as a legend for the type
 * chip each card carries.
 *
 * Writes `?topic-types=`, the same param the sort picker used to, so links
 * shared before the chips existed still land on the right type.
 *
 * `strip` keeps the chips on one line and scrolls it sideways, for the desktop
 * toolbar where they share the row with the pickers: wrapped, eight types
 * stacked four rows deep beside two controls a single row tall. An edge fades
 * only while there are chips past it, so a row that fits shows no fade at all.
 */
export default function TopicTypeFilter({
  className,
  layout = 'wrap'
}: {
  className?: string
  layout?: 'strip' | 'wrap'
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const topicTypes = useTaxonomiesStoreSelect()?.['bit-connect-topic-types'] || []
  const current = searchParams.get('topic-types') || ''

  const isStrip = layout === 'strip'
  const stripRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ end: false, start: false })

  useEffect(() => {
    const strip = stripRef.current
    if (!isStrip || !strip) return

    // A pixel of slack: scrollLeft lands on fractions at non-integer zoom.
    const measure = () =>
      setOverflow({
        end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
        start: strip.scrollLeft > 1
      })

    measure()
    strip.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(strip)

    return () => {
      strip.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [isStrip, topicTypes.length])

  if (topicTypes.length === 0) return

  const select = (slug: string) =>
    setSearchParams(prev => {
      if (slug) {
        prev.set('topic-types', slug)
      } else {
        prev.delete('topic-types')
      }
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  const chips = [
    { label: __('All'), slug: '' },
    ...topicTypes.map(type => ({ label: type.name, slug: type.slug }))
  ]

  const mask = isStrip
    ? `linear-gradient(to right, ${overflow.start ? 'transparent' : '#000'}, #000 ${FADE}, #000 calc(100% - ${FADE}), ${overflow.end ? 'transparent' : '#000'})`
    : undefined

  // The strip's vertical padding keeps the chips' focus outline inside it,
  // since a scrolling box clips anything past its edges.
  return (
    <div
      aria-label={__('Topic type')}
      className={cn([
        'bc-flex bc-items-center bc-gap-2',
        isStrip
          ? 'bc-min-w-0 bc-overflow-x-auto bc-py-1'
          : 'bc-flex-wrap',
        className
      ])}
      ref={stripRef}
      role="group"
      // No scrollbar: the faded edge already says "more this way", and a trough
      // under one row of chips reads as a rendering fault. Trackpad, shift-wheel
      // and keyboard focus still scroll it.
      style={mask ? { maskImage: mask, scrollbarWidth: 'none', WebkitMaskImage: mask } : undefined}
    >
      {chips.map(chip => {
        const isActive = chip.slug === current

        return (
          <button
            aria-pressed={isActive}
            className={cn([
              'bc-inline-flex bc-h-8 bc-shrink-0 bc-cursor-pointer bc-items-center bc-whitespace-nowrap bc-rounded-md bc-border bc-border-solid bc-px-3 bc-text-sm bc-transition-colors',
              'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40',
              isActive
                ? 'bc-border-primary/30 bc-bg-primary/10 bc-font-medium bc-text-primary'
                : 'bc-border-line bc-bg-surface bc-text-ink-muted hover:bc-border-line-strong hover:bc-text-ink'
            ])}
            key={chip.slug || 'all'}
            onClick={event => {
              select(chip.slug)
              // Bring a chip clicked half under the fade fully into view.
              if (isStrip) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            }}
            type="button"
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
