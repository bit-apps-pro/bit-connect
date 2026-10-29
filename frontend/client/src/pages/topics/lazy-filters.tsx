import { cn } from '@common/helpers/globalHelpers'
import { lazy, Suspense } from 'react'

/**
 * The sort and tag pickers, loaded right after the first download instead of
 * inside it.
 *
 * Both are antd Selects, and Select with its helpers (rc-select, the virtual
 * list, the empty state) is about a fifth of what the list page would
 * otherwise download before it can draw anything. Nothing else on the first
 * screen uses it. The chunk starts loading as soon as this module runs, so the
 * placeholder is up for the moment that download takes, not for a round trip
 * started later.
 *
 * The placeholder keeps the picker's box — same height, width, corners and
 * frame — so the toolbar does not move when the real one replaces it.
 */
const loadSortFilter = () => import('@utilities/sort-filter/sort-filter')
const loadTagFilter = () => import('@utilities/tag-filter/tag-filter')

const SortFilter = lazy(loadSortFilter)
const TagFilter = lazy(loadTagFilter)

// allSettled never rejects: a failed head start is retried when the pickers
// render, so there is nothing to handle here.
void Promise.allSettled([loadSortFilter(), loadTagFilter()])

function PickerPlaceholder({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn([
        'bc-shrink-0 bc-rounded-md bc-border bc-border-solid bc-border-line bc-bg-surface-hover',
        className
      ])}
    />
  )
}

export function LazySortFilter() {
  return (
    <Suspense fallback={<PickerPlaceholder className="bc-h-8 bc-w-[92px]" />}>
      <SortFilter />
    </Suspense>
  )
}

/** @param block a full-width field — see TagFilter. */
export function LazyTagFilter({ block = false }: { block?: boolean }) {
  return (
    <Suspense fallback={<PickerPlaceholder className={block ? 'bc-h-10 bc-w-full' : 'bc-h-8 bc-w-[200px]'} />}>
      <TagFilter block={block} />
    </Suspense>
  )
}
