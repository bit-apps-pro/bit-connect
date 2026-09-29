import { cn } from '@common/helpers/globalHelpers'
import { __ } from '@common/helpers/i18nWrap'
import { useSearchParams } from 'react-router'

import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

/**
 * The topic types as a row of chips — All first, then each type in the admin's
 * order. One is always pressed, so the row doubles as a legend for the type
 * chip each card carries.
 *
 * Writes `?topic-types=`, the same param the sort picker used to, so links
 * shared before the chips existed still land on the right type.
 */
export default function TopicTypeFilter({ className }: { className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const topicTypes = useTaxonomiesStoreSelect()?.['bit-connect-topic-types'] || []
  const current = searchParams.get('topic-types') || ''

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

  return (
    <div
      aria-label={__('Topic type')}
      className={cn(['bc-flex bc-flex-wrap bc-items-center bc-gap-2', className])}
      role="group"
    >
      {chips.map(chip => {
        const isActive = chip.slug === current

        return (
          <button
            aria-pressed={isActive}
            className={cn([
              'bc-inline-flex bc-h-8 bc-cursor-pointer bc-items-center bc-rounded-md bc-border bc-border-solid bc-px-3 bc-text-sm bc-transition-colors',
              'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40',
              isActive
                ? 'bc-border-primary/30 bc-bg-primary/10 bc-font-medium bc-text-primary'
                : 'bc-border-line bc-bg-surface bc-text-ink-muted hover:bc-border-line-strong hover:bc-text-ink'
            ])}
            key={chip.slug || 'all'}
            onClick={() => select(chip.slug)}
            type="button"
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
