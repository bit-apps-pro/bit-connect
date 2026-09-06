import './topics.css'

import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import ProductFilter from '@utilities/product-filter'
import SearchInput from '@utilities/search-input'
import SortFilter from '@utilities/sort-filter'
import TagFilter, { parseTagParam, tagLabel } from '@utilities/tag-filter'
import TopicCard from '@utilities/topic-card'
import getScrollParent from '@utils/get-scroll-parent'
import { Button, Drawer } from 'antd'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowUp, LuSlidersHorizontal, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import config from '@/config/config'
import { useAuthStore } from '@/store/auth.zustand'
import { usePostsStore } from '@/store/posts.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

/** Hide the back-to-top button this long (ms) after scrolling stops. */
const SCROLL_IDLE_HIDE_MS = 1500

/** Modern "elevated dark circle" styling for the mobile filter button. */
// Quiet neutral circle matching the filled search input beside it — the filter
// is a secondary control, not a call to action. The active-filter state is
// signalled by the small blue dot, not by the button itself.
const FILTER_BUTTON_CLASS = [
  'bc-group bc-relative bc-flex bc-h-10 bc-w-10 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center',
  'bc-rounded-full bc-border-none bc-bg-surface-raised bc-text-ink-subtle',
  'bc-transition-colors bc-duration-200 bc-ease-out',
  'hover:bc-bg-surface-raised hover:bc-text-ink-muted',
  'active:bc-scale-95'
].join(' ')

export interface TopicsProps {
  /**
   * Filter pinned by a term-archive route, merged over the query-string filters.
   * Keys match the filter payload below (`tags`, `topic-types`, …).
   */
  archiveFilter?: Record<string, string>
}

export default function Topics({ archiveFilter }: TopicsProps = {}) {
  const { notificationApi } = useContext(NotifyContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'newest'
  const product = searchParams.get('product') || ''
  const stages = searchParams.get('stage') || config.DEFAULT_STAGE_SLUG
  const visibility = searchParams.get('visibility') || ''
  const myTopics = searchParams.get('my_topics') || ''
  const topicType = searchParams.get('topic-types') || ''
  const tagSlugs = useMemo(() => parseTagParam(searchParams.get('tags')), [searchParams])
  // Normalised back to the wire format, so a re-render with an equivalent URL
  // (`tags=a,,a`) doesn't look like a new filter to the fetch effect below.
  const tags = tagSlugs.join(',')

  // Each filter control can be switched off per-site (admin → General → Portal
  // Filters). Hiding one removes its control, its chip and its share of the
  // reset/"filters are active" state; the matching URL params are still applied
  // to the query below, so links people have already shared keep working.
  const { product: showProductFilter, sort: showSortFilter, tags: showTagFilter } = config.PORTAL_FILTERS
  const showAnyFilter = showSortFilter || showProductFilter || showTagFilter

  const [filterOpen, setFilterOpen] = useState(false)
  const hasActiveFilters =
    (showSortFilter &&
      (sortBy !== 'newest' || visibility !== '' || myTopics !== '' || topicType !== '')) ||
    (showProductFilter && product !== '') ||
    (showTagFilter && tags !== '')

  // Active (non-default) filters, shown as removable chips under the search bar.
  const taxonomies = useTaxonomiesStoreSelect()
  const topicTypes = taxonomies?.['bit-connect-topic-types'] || []
  const departments = taxonomies?.['bit-connect-departments'] || []
  const tagTerms = taxonomies?.['bit-connect-tags'] || []

  const clearSort = () =>
    setSearchParams(prev => {
      for (const key of ['sort', 'visibility', 'my_topics', 'topic-types']) {
        prev.delete(key)
      }
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  const clearProduct = () =>
    setSearchParams(prev => {
      prev.delete('product')
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  // Drop one tag while leaving the rest of the selection in place — the chips
  // are per-tag, so removing one must not clear the whole filter.
  const removeTag = (slug: string) =>
    setSearchParams(prev => {
      const remaining = parseTagParam(prev.get('tags')).filter(current => current !== slug)
      if (remaining.length === 0) {
        prev.delete('tags')
      } else {
        prev.set('tags', remaining.join(','))
      }
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  // Only clears what the visitor can see — a param behind a hidden control has
  // no chip and no switch, so wiping it here would look like a random change.
  const resetFilters = () =>
    setSearchParams(prev => {
      const keys = [
        ...(showSortFilter ? ['sort', 'visibility', 'my_topics', 'topic-types'] : []),
        ...(showProductFilter ? ['product'] : []),
        ...(showTagFilter ? ['tags'] : [])
      ]
      for (const key of keys) {
        prev.delete(key)
      }
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  const activeChips: { key: string; label: string; onRemove: () => void }[] = []
  if (showSortFilter) {
    if (myTopics === 'true') {
      activeChips.push({ key: 'sort', label: __('My Topics'), onRemove: clearSort })
    } else if (visibility === 'private') {
      activeChips.push({ key: 'sort', label: __('Private'), onRemove: clearSort })
    } else if (topicType !== '') {
      activeChips.push({
        key: 'sort',
        label: topicTypes.find(t => t.slug === topicType)?.name ?? topicType,
        onRemove: clearSort
      })
    } else if (sortBy !== 'newest') {
      activeChips.push({ key: 'sort', label: __('Oldest'), onRemove: clearSort })
    }
  }
  if (showProductFilter && product !== '') {
    activeChips.push({
      key: 'product',
      label: departments.find(d => d.slug === product)?.name ?? product,
      onRemove: clearProduct
    })
  }
  if (showTagFilter) {
    for (const slug of tagSlugs) {
      activeChips.push({
        key: `tag:${slug}`,
        label: tagLabel(tagTerms.find(term => term.slug === slug)?.name ?? slug),
        onRemove: () => removeTag(slug)
      })
    }
  }

  const { isLoggedIn } = useAuthStore()
  const { open: openLoginWarning } = useLoginWarningStore()

  // A term archive (`/tag/api`) pins its filter from the path rather than the
  // query string, so it stays the clean, canonical URL the server advertised
  // instead of being rewritten to `?tags=api` the moment React mounts.
  const filters = useMemo(
    () => ({
      departments: product,
      my_topics: myTopics,
      search,
      sortBy,
      stages,
      tags,
      'topic-types': topicType,
      visibility,
      ...archiveFilter
    }),
    [product, myTopics, search, sortBy, stages, tags, topicType, visibility, archiveFilter]
  )

  const { fetchAllPosts, fetchMorePosts, hasMore, isLoading, isLoadingMore, posts, toggleVote } =
    usePostsStore()

  // Applying a filter changes this key, remounting the list container so the
  // cards replay their entrance animation — the visual cue that the result set
  // changed. Appended pages (infinite scroll) keep the same key, so only the
  // new cards animate in.
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  const shouldReduceMotion = useReducedMotion()
  const cardMotion = (index: number) => ({
    animate: { opacity: 1, y: 0 },
    initial: shouldReduceMotion ? false : { opacity: 0, y: 12 },
    // Stagger is capped so late infinite-scroll pages don't accumulate delay.
    transition: { delay: Math.min(index * 0.05, 0.3), duration: 0.3, ease: 'easeOut' as const }
  })

  // (Re)load the first page on mount and whenever the filters change.
  useEffect(() => {
    fetchAllPosts(filters).catch(() => {
      notificationApi?.error({ message: __('Failed to load posts') })
    })
  }, [filters, fetchAllPosts, notificationApi])

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  // The list lives inside a scrollable layout container, so observe relative to
  // the nearest scrollable ancestor rather than the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          // fetchMorePosts guards against concurrent calls internally.
          fetchMorePosts().catch(() => {
            notificationApi?.error({ message: __('Failed to load more posts') })
          })
        }
      },
      { root: getScrollParent(node), rootMargin: '300px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
    // `isLoading`/`posts.length` are included because the sentinel is only
    // rendered once loading finishes and there are posts. Without them the
    // observer wouldn't re-attach after a client-side navigation where
    // `hasMore` is already true (carried over in the persistent store).
  }, [hasMore, fetchMorePosts, notificationApi, isLoading, posts.length])

  // Scroll-to-top button: show it while the user scrolls down past a threshold,
  // then auto-hide once scrolling stops for SCROLL_IDLE_HIDE_MS.
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | undefined>(undefined)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setShowScrollTop(false), SCROLL_IDLE_HIDE_MS)
  }, [clearHideTimer])

  useEffect(() => {
    const container = getScrollParent(rootRef.current)
    scrollParentRef.current = container
    const target: HTMLElement | Window = container ?? window

    const onScroll = () => {
      const top = container ? container.scrollTop : window.scrollY
      if (top > 400) {
        setShowScrollTop(true)
        scheduleHide()
      } else {
        setShowScrollTop(false)
        clearHideTimer()
      }
    }

    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      clearHideTimer()
    }
  }, [clearHideTimer, scheduleHide])

  const scrollToTop = () => {
    const container = scrollParentRef.current
    if (container) {
      container.scrollTo({ behavior: 'smooth', top: 0 })
    } else {
      window.scrollTo({ behavior: 'smooth', top: 0 })
    }
  }

  const handlePostVote = async (postId: number) => {
    if (!isLoggedIn) {
      openLoginWarning()
      return
    }
    try {
      await toggleVote(postId)
    } catch {
      notificationApi?.error({ message: __('Failed to vote on post') })
    }
  }

  return (
    // 16px on phones, matching the topic page's gutter at the same width: the
    // two are the same journey, and at 12 here the card edges sat 4px inside
    // where the topic's own text lands, so tapping a card shifted everything.
    // From sm both fall back to 12, where each panel adds padding of its own.
    <div className="bc-p-4 sm:bc-p-3 lg:bc-p-4 lg:bc-space-y-4" ref={rootRef}>
      <div className="bc-flex bc-flex-col bc-gap-2 bc-mb-4">
        {/* mobile: always-visible search + a filter button that opens a sheet */}
        <div className="bc-flex bc-items-center bc-gap-2 lg:bc-hidden">
          <SearchInput className="bc-flex-1" />
          {showAnyFilter && (
            <button
              aria-label={__('Filters')}
              className={FILTER_BUTTON_CLASS}
              onClick={() => setFilterOpen(true)}
              type="button"
            >
              <LuSlidersHorizontal size={18} />
              {hasActiveFilters && (
                <span className="filter-dot-pulse bc-absolute bc-right-2 bc-top-2 bc-h-2 bc-w-2 bc-rounded-full bc-bg-primary" />
              )}
            </button>
          )}
        </div>

        {/* mobile: active (non-default) filters as removable chips. The row
            collapses/expands as chips come and go; each chip pops in and out. */}
        <AnimatePresence initial={false}>
          {activeChips.length > 0 && (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="bc-flex bc-flex-wrap bc-items-center bc-gap-2 bc-overflow-hidden lg:bc-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              key="filter-chips"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {activeChips.map(chip => (
                  <motion.span
                    animate={{ opacity: 1, scale: 1 }}
                    className="bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-bg-surface-raised bc-py-1 bc-pl-3 bc-pr-1.5 bc-text-xs bc-font-medium bc-text-ink-muted"
                    exit={{ opacity: 0, scale: 0.85 }}
                    initial={{ opacity: 0, scale: 0.85 }}
                    key={chip.key}
                    layout
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    {chip.label}
                    {/* 24px hit area — the WCAG 2.5.8 minimum target size; a 16px
                        button is easy to miss with a thumb. */}
                    <button
                      aria-label={__('Remove filter')}
                      className="bc-flex bc-h-6 bc-w-6 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded-full bc-border-none bc-bg-transparent bc-text-ink-subtle bc-transition-colors hover:bc-bg-surface-raised hover:bc-text-ink-muted"
                      onClick={chip.onRemove}
                      type="button"
                    >
                      <LuX size={14} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* desktop toolbar row */}
        <div className="bc-hidden bc-items-center bc-justify-between lg:bc-flex lg:bc-gap-12">
          <SearchInput className="bc-min-w-48" />
          {showAnyFilter && (
            <div className="bc-flex bc-items-center bc-gap-3">
              {showSortFilter && <SortFilter />}
              {showProductFilter && <ProductFilter />}
              {showTagFilter && <TagFilter />}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet, opened by the filter button above. */}
      <Drawer
        className="lg:bc-hidden"
        extra={
          <Button disabled={!hasActiveFilters} onClick={resetFilters} size="small" type="link">
            {__('Reset')}
          </Button>
        }
        height="auto"
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        placement="bottom"
        styles={{ content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
        title={__('Filters')}
      >
        <div className="bc-flex bc-flex-col bc-gap-3 bc-pb-2">
          {showSortFilter && (
            <div className="bc-flex bc-items-center bc-justify-between bc-gap-3 bc-rounded-lg bc-bg-surface-sunken bc-px-4 bc-py-2.5">
              <span className="bc-text-sm bc-font-medium bc-text-ink-muted">{__('Sort by')}</span>
              <SortFilter />
            </div>
          )}
          {showProductFilter && (
            <div className="bc-flex bc-items-center bc-justify-between bc-gap-3 bc-rounded-lg bc-bg-surface-sunken bc-px-4 bc-py-2.5">
              <span className="bc-text-sm bc-font-medium bc-text-ink-muted">{__('Product')}</span>
              <ProductFilter />
            </div>
          )}
          {showTagFilter && (
            <div className="bc-flex bc-items-center bc-justify-between bc-gap-3 bc-rounded-lg bc-bg-surface-sunken bc-px-4 bc-py-2.5">
              <span className="bc-text-sm bc-font-medium bc-text-ink-muted">{__('Tags')}</span>
              <TagFilter />
            </div>
          )}
        </div>
      </Drawer>

      {isLoading && (
        <div className="bc-flex bc-items-center bc-justify-center bc-p-8">
          <span>{__('Loading posts...')}</span>
        </div>
      )}
      {!isLoading && posts.length === 0 && (
        <div className="bc-flex bc-items-center bc-justify-center bc-p-8">
          <span>{__('No posts found')}</span>
        </div>
      )}
      {!isLoading && posts.length > 0 && (
        <div className="bc-flex bc-flex-col bc-gap-4" key={filtersKey}>
          {posts.map((topic, index) => (
            <motion.div key={topic.ID} {...cardMotion(index)}>
              <TopicCard onVote={handlePostVote} topic={topic} />
            </motion.div>
          ))}

          {/* Sentinel: observed to trigger loading the next page */}
          <div aria-hidden="true" className="bc-h-px" ref={sentinelRef} />

          {isLoadingMore && (
            <div className="bc-flex bc-items-center bc-justify-center bc-p-4">
              <span>{__('Loading more...')}</span>
            </div>
          )}

          {!hasMore && !isLoadingMore && (
            <div className="bc-flex bc-items-center bc-justify-center bc-p-4 bc-text-ink-subtle bc-text-sm">
              <span>{__("🎉 You're all caught up — no more topics")}</span>
            </div>
          )}
        </div>
      )}

      {/* Sticky inside the list rather than fixed to the viewport: fixed +
          left-1/2 measured from the window, so the sider pushed the pill 135px
          left of the column it scrolls. The wrapper takes no pointer events, so
          the band it spans doesn't swallow clicks meant for the cards beneath —
          the button itself only becomes clickable once `.is-visible` sets
          pointer-events (see topics.css). */}
      <div className="bc-pointer-events-none bc-sticky bc-bottom-6 bc-z-50 bc-flex bc-justify-center">
        <button
          aria-label={__('Back to top')}
          // min-h-11 (44px): at 40px the pill was under the touch-target guideline.
          className={`back-to-top-btn bc-flex bc-min-h-11 bc-items-center bc-gap-2 bc-rounded-full bc-border-none bc-cursor-pointer bc-px-5 bc-py-2.5 bc-text-sm bc-font-semibold bc-text-white${showScrollTop ? ' is-visible' : ''}`}
          onClick={scrollToTop}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
          type="button"
        >
          <LuArrowUp size={18} />
          <span>{__('Back to top')}</span>
        </button>
      </div>
    </div>
  )
}
