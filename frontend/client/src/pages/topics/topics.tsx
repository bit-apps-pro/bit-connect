import './topics.css'

import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import useCapabilityGate from '@common/hooks/useCapabilityGate'
import usePageTitle from '@common/hooks/usePageTitle'
import SortFilter from '@utilities/sort-filter'
import TagFilter, { parseTagParam, tagLabel } from '@utilities/tag-filter'
import TopicCard from '@utilities/topic-card'
import TopicTypeFilter from '@utilities/topic-type-filter'
import getScrollParent from '@utils/get-scroll-parent'
import { Button, Drawer } from 'antd'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowUp, LuSlidersHorizontal, LuX } from 'react-icons/lu'
import { useSearchParams } from 'react-router'

import config from '@/config/config'
import { usePostsStore } from '@/store/posts.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'

import useAddedViews from '../../components/utilities/sort-filter/use-added-views'
import useListingSelection from '../Layout/data/use-listing-selection'
import { ALL_STAGES } from '../Layout/ui/Sidebar/listing-link'
import ArchiveHeader from './archive-header'
import ListingContext from './listing-context'
import TopicListBanners from './topic-list-banners'

/** Hide the back-to-top button this long (ms) after scrolling stops. */
const SCROLL_IDLE_HIDE_MS = 1500

// A bordered square matching the search field beside it: same height, corners
// and rule, so the two read as one toolbar. The filter is a secondary control,
// not a call to action — the active-filter state is signalled by the small
// blue dot, not by the button itself.
const FILTER_BUTTON_CLASS = [
  'bc-group bc-relative bc-flex bc-h-10 bc-w-10 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center',
  'bc-rounded-[8px] bc-border bc-border-solid bc-border-line bc-bg-surface-hover bc-text-ink',
  'bc-transition-colors bc-duration-200 bc-ease-out',
  'hover:bc-border-primary hover:bc-text-primary',
  'active:bc-scale-95'
].join(' ')

export interface TopicsProps {
  /**
   * Filter pinned by a term-archive route, merged over the query-string filters.
   * Keys match the filter payload below (`tags`, `topic-types`, …).
   */
  archiveFilter?: Record<string, string>
  /**
   * Whether a term archive draws its own heading above the list. Off when a
   * plugin lays the archive out as a page of its own — see archive-page-for.
   */
  showArchiveHeader?: boolean
}

export default function Topics({ archiveFilter, showArchiveHeader = true }: TopicsProps = {}) {
  const { notificationApi } = useContext(NotifyContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sort') || 'newest'
  const visibility = searchParams.get('visibility') || ''
  const myTopics = searchParams.get('my_topics') || ''
  // A named list counts only while the sort control offers it; a stale
  // `?view=` is the ordinary listing.
  const viewParam = searchParams.get('view') || ''
  const activeView = useAddedViews().find(offered => offered.value === viewParam)
  const view = activeView ? activeView.value : ''
  const topicType = searchParams.get('topic-types') || ''
  const tagSlugs = useMemo(() => parseTagParam(searchParams.get('tags')), [searchParams])
  // Normalised back to the wire format, so a re-render with an equivalent URL
  // (`tags=a,,a`) doesn't look like a new filter to the fetch effect below.
  const tags = tagSlugs.join(',')

  // The listing shows one stage at a time — the sidebar's stages are its
  // primary navigation, so a bare `/` is the default stage. A search, a tag
  // filter or a term archive is a question about the whole forum, though: the
  // tag picker counts topics across every stage, and "no posts found" under a
  // tag that plainly has three is the answer the old stage default gave. Those
  // span all stages unless the URL names one, and `?stage=` still wins. So does
  // a named list from the sort control, which is its own question.
  //
  // The archive the listing is scoped to is the exception among archives: the
  // sidebar's stages stay beside it and narrow it, so it is the forum's own
  // listing over fewer topics, and opens on the default stage as the root does.
  //
  // A search drops the listing scope and any stage — even one the URL names.
  // It keeps a term archive, though: the header's search box only lands on an
  // archive with `?search=` when the reader searched *in* it (a board, a tag),
  // the way a forum's search stays inside the board you are on; a search for
  // everything goes to the root. The refinements the reader picked here (sort,
  // type, tags) still apply, since their chips stay on screen beside the
  // results.
  const { scope: pageScope } = useListingSelection()
  const isSearching = search !== ''
  const scopeFilter = archiveFilter
  const listingScope = isSearching ? '' : pageScope
  const stageParam = isSearching ? '' : searchParams.get('stage') || ''
  const spansAllStages =
    isSearching || tags !== '' || view !== '' || (scopeFilter !== undefined && listingScope === '')
  const stages =
    stageParam === ALL_STAGES ? '' : stageParam || (spansAllStages ? '' : config.DEFAULT_STAGE_SLUG)
  // Cards name their stage only where the list mixes them; under one stage the
  // picker already says which.
  const showsStageBadges = stages === ''

  // Each filter control can be switched off per-site (admin → General → Portal
  // Filters). Hiding one removes its control, its chip and its share of the
  // reset/"filters are active" state; the matching URL params are still applied
  // to the query below, so links people have already shared keep working.
  const { sort: showSortFilter, tags: showTagFilter, types: showTypeFilter } = config.PORTAL_FILTERS
  const showAnyFilter = showSortFilter || showTagFilter
  // A type archive (`/topic/bug`) has already chosen, and a chip there could
  // not override the path anyway.
  const showTypeChips = showTypeFilter && !scopeFilter?.['topic-types']

  const [filterOpen, setFilterOpen] = useState(false)
  const hasActiveFilters =
    (showSortFilter && (sortBy !== 'newest' || visibility !== '' || myTopics !== '' || view !== '')) ||
    (showTypeFilter && topicType !== '') ||
    (showTagFilter && tags !== '')

  // Active (non-default) filters, shown as removable chips under the search bar.
  const taxonomies = useTaxonomiesStoreSelect()
  const topicTypes = taxonomies?.['bit-connect-topic-types'] || []
  const tagTerms = taxonomies?.['bit-connect-tags'] || []

  // The tab title, as the server sets it: the community name for the listing,
  // "Term — Community" for an archive. Left alone until the term's name has
  // loaded, rather than flashing the bare community name first.
  const [archiveKey, archiveSlug] = archiveFilter ? (Object.entries(archiveFilter)[0] ?? []) : []
  const archive = archiveKey ? Object.values(config.PORTAL_ARCHIVES).find(a => a.filter === archiveKey) : undefined
  const archiveTerm = archive ? taxonomies?.[archive.taxonomy]?.find(term => term.slug === archiveSlug) : undefined
  const archiveName = archiveKey ? archiveTerm?.name : ''
  usePageTitle(archiveName)

  const clearSort = () =>
    setSearchParams(prev => {
      for (const key of ['sort', 'visibility', 'my_topics', 'view']) {
        prev.delete(key)
      }
      if (prev.has('page')) prev.set('page', '1')
      return prev
    })

  const clearTopicType = () =>
    setSearchParams(prev => {
      prev.delete('topic-types')
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
        ...(showSortFilter ? ['sort', 'visibility', 'my_topics', 'view'] : []),
        ...(showTypeFilter ? ['topic-types'] : []),
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
    if (activeView) {
      activeChips.push({ key: 'sort', label: activeView.label, onRemove: clearSort })
    } else if (myTopics === 'true') {
      activeChips.push({ key: 'sort', label: __('My Topics'), onRemove: clearSort })
    } else if (visibility === 'private') {
      activeChips.push({ key: 'sort', label: __('Private'), onRemove: clearSort })
    } else if (sortBy !== 'newest') {
      activeChips.push({ key: 'sort', label: __('Oldest'), onRemove: clearSort })
    }
  }
  if (showTypeFilter && topicType !== '') {
    activeChips.push({
      key: 'topic-type',
      label: topicTypes.find(t => t.slug === topicType)?.name ?? topicType,
      onRemove: clearTopicType
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

  const canAct = useCapabilityGate()

  // A term archive (`/tag/api`) pins its filter from the path rather than the
  // query string, so it stays the clean, canonical URL the server advertised
  // instead of being rewritten to `?tags=api` the moment React mounts.
  const filters = useMemo(
    () => ({
      my_topics: myTopics,
      search,
      sortBy,
      stages,
      tags,
      'topic-types': topicType,
      view,
      visibility,
      ...scopeFilter
    }),
    [myTopics, search, sortBy, stages, tags, topicType, view, visibility, scopeFilter]
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
    if (!canAct('bit_connect_forum_vote_post')) return
    try {
      await toggleVote(postId)
    } catch {
      notificationApi?.error({ message: __('Failed to vote on post') })
    }
  }

  // Where the list is: the term a tag, type or status archive is listing, which
  // spans every stage.
  const listingContext = (
    <ListingContext
      archiveName={
        !isSearching && archiveKey && archiveKey !== 'stages' && listingScope === ''
          ? (archiveName ?? archiveSlug)
          : ''
      }
    />
  )

  // Active (non-default) filters as removable chips, in the type strip's
  // selected style — each one is a filter the reader switched on. Each chip
  // pops in and out.
  const filterChips = (
    <AnimatePresence initial={false}>
      {activeChips.length > 0 && (
        <m.div
          animate={{ opacity: 1 }}
          className="bc-flex bc-shrink-0 bc-flex-wrap bc-items-center bc-gap-2 max-lg:bc-flex-nowrap"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key="filter-chips"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {activeChips.map(chip => (
              <m.span
                animate={{ opacity: 1, scale: 1 }}
                className="bc-inline-flex bc-h-8 bc-shrink-0 bc-items-center bc-gap-1 bc-whitespace-nowrap bc-rounded-md bc-border bc-border-solid bc-border-primary/30 bc-bg-primary/10 bc-pl-3 bc-pr-1 bc-text-sm bc-font-medium bc-text-primary"
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
                  className="bc-flex bc-h-6 bc-w-6 bc-shrink-0 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded bc-border-none bc-bg-transparent bc-text-primary bc-transition-colors hover:bc-bg-primary/15"
                  onClick={chip.onRemove}
                  type="button"
                >
                  <LuX size={14} />
                </button>
              </m.span>
            ))}
          </AnimatePresence>
        </m.div>
      )}
    </AnimatePresence>
  )

  return (
    // 16px on phones, matching the topic page's gutter at the same width: the
    // two are the same journey, and at 12 here the card edges sat 4px inside
    // where the topic's own text lands, so tapping a card shifted everything.
    // From sm both fall back to 12, where each panel adds padding of its own.
    <div className="bc-p-4 sm:bc-p-3 lg:bc-p-6 lg:bc-space-y-4" ref={rootRef}>
      <div className="bc-flex bc-flex-col bc-gap-2 bc-mb-4">
        {TopicListBanners && <TopicListBanners />}

        {/* A term archive's own heading, description and Follow. Not for a
            stage archive, which the stage picker already names, nor the archive
            the listing is scoped to, which is the picker beside it. */}
        {showArchiveHeader && !isSearching && archive && archiveKey !== 'stages' && listingScope === '' && (
          <ArchiveHeader archive={archive} term={archiveTerm} />
        )}

        {/* below lg: where the list is and what narrows it, on one line, with
            the button that opens the filter sheet at the end. The place chips
            truncate before the filters do, since a filter's name is what its
            remove button acts on; past that the row scrolls sideways. Search
            itself lives in the header. */}
        <div className="bc-flex bc-items-center bc-gap-2 lg:bc-hidden">
          <div
            className="bc-flex bc-min-w-0 bc-flex-1 bc-items-center bc-gap-2 bc-overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {listingContext}
            {filterChips}
          </div>
          {(showAnyFilter || showTypeChips) && (
            <button
              aria-label={__('Filters')}
              className={FILTER_BUTTON_CLASS}
              onClick={() => setFilterOpen(true)}
              type="button"
            >
              <LuSlidersHorizontal size={20} />
              {hasActiveFilters && (
                <span className="filter-dot-pulse bc-absolute bc--right-1 bc--top-1 bc-h-2.5 bc-w-2.5 bc-rounded-full bc-bg-primary bc-ring-2 bc-ring-surface" />
              )}
            </button>
          )}
        </div>

        {/* desktop toolbar, one row: the type chips from the left edge,
            taking whatever width is left and scrolling sideways past it, then
            every picker together on the right — where the list is (stage, and
            any added choice) beside the ones that sort and narrow it. Search
            and Create are the header's, on every page. The chips had a row of
            their own once, beside the search box; with that gone it left two
            half-empty rows. */}
        <div className="bc-hidden bc-flex-col bc-gap-3 lg:bc-flex">
          <div className="bc-flex bc-items-center bc-gap-3">
            {showTypeChips && (
              <TopicTypeFilter className="bc-flex-1" layout="strip" scope={scopeFilter} />
            )}
            {/* ml-auto: with no chips the pickers still hold the right edge. */}
            <div className="bc-ml-auto bc-flex bc-shrink-0 bc-items-center bc-gap-3">
              {listingContext}
              {showSortFilter && <SortFilter />}
              {showTagFilter && <TagFilter />}
            </div>
          </div>
          {activeChips.length > 0 && (
            <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-2">
              {filterChips}
              <Button onClick={resetFilters} size="small" type="link">
                {__('Clear all')}
              </Button>
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
        {/* Label over control, no tinted panels: the sheet takes the toolbar's
            white surface and its fields take the search box's treatment, so
            opening it does not change the page's visual language. */}
        <div className="bc-flex bc-flex-col bc-gap-5 bc-pb-2">
          {showTypeChips && (
            <div className="bc-flex bc-flex-col bc-gap-2">
              <span className="bc-text-sm bc-font-medium bc-text-ink">{__('Topic type')}</span>
              <TopicTypeFilter scope={scopeFilter} />
            </div>
          )}
          {showSortFilter && (
            <div className="bc-flex bc-flex-col bc-gap-2">
              <span className="bc-text-sm bc-font-medium bc-text-ink">{__('Sort by')}</span>
              <SortFilter block />
            </div>
          )}
          {showTagFilter && (
            <div className="bc-flex bc-flex-col bc-gap-2">
              <span className="bc-text-sm bc-font-medium bc-text-ink">{__('Tags')}</span>
              <TagFilter block />
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
            <m.div key={topic.ID} {...cardMotion(index)}>
              <TopicCard onVote={handlePostVote} showStage={showsStageBadges} topic={topic} />
            </m.div>
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
              <span>{__("🎉 You're all caught up. That's every topic!")}</span>
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
