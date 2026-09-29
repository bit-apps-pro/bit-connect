import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import usePageTitle from '@common/hooks/usePageTitle'
import { type Topic } from '@features/topic-modal/shared/type'
import TabNav, { type TabItem } from '@utilities/tab-nav'
import TopicCard from '@utilities/topic-card'
import getScrollParent from '@utils/get-scroll-parent'
import { Empty, Pagination, Select, Skeleton } from 'antd'
import { motion, useReducedMotion } from 'framer-motion'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { LuArrowLeft, LuCalendar } from 'react-icons/lu'
import { Link, useParams, useSearchParams } from 'react-router'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import { useAuthStore } from '@/store/auth.zustand'
import { usePostsStore } from '@/store/posts.zustand'

import useUserContent, {
  PROFILE_PAGE_SIZE,
  type ProfileTab,
  type UserComment
} from './data/use-user-content'
import useUserInsights, { type InsightPeriod } from './data/use-user-insights'
import useUserPermissions from './data/use-user-permissions'
import useUserProfile from './data/use-user-profile'
import CommentRow from './ui/CommentRow'
import InsightsOverview from './ui/InsightsOverview'
import ManageSection from './ui/ManageSection'
import ProfileCard from './ui/ProfileCard'

/**
 * Tabs: `overview` is the activity dashboard, `manage` a settings pane, and
 * the rest paginated lists.
 */
type View = 'manage' | ProfileTab

const VIEWS = new Set<View>(['comments', 'manage', 'overview', 'topics', 'votes'])
/** Views that render a paginated list from the content endpoint. */
const LIST_VIEWS = new Set<View>(['comments', 'topics', 'votes'])
/** Views only the profile's owner may open. */
const OWNER_ONLY = new Set<View>(['manage', 'votes'])

const isView = (value: null | string): value is View => value !== null && VIEWS.has(value as View)

/** Empty-state copy per list, keyed so no nested ternary is needed inline. */
const EMPTY_MESSAGE: Record<ProfileTab, () => string> = {
  comments: () => __('No comments yet.'),
  overview: () => __('Nothing here yet.'),
  topics: () => __('No topics yet.'),
  votes: () => __('No upvoted topics yet.')
}

const PERIOD_OPTIONS: { label: () => string; value: InsightPeriod }[] = [
  { label: () => __('Last 7 days'), value: '7d' },
  { label: () => __('Last 30 days'), value: '30d' },
  { label: () => __('Last 12 months'), value: '12m' },
  { label: () => __('All time'), value: 'all' }
]

/**
 * A member's public profile.
 *
 * Laid out as content with an identity card in a rail beside it: the content is
 * what a visitor came for, so it takes the primary column, and the card stays
 * put while it scrolls. The Overview opens on what the member did over a
 * period; the other tabs list the content itself.
 *
 * Readable by anyone who can read the portal, matching the topics and comments
 * it lists. "Upvoted" and "Manage profile" are the exceptions and are only
 * offered to the member themselves — the endpoints enforce that independently;
 * this just avoids showing controls that would 403.
 */
export default function UserProfilePage() {
  const { userSlug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { notificationApi } = useContext(NotifyContext)
  const shouldReduceMotion = useReducedMotion()

  // The URL carries a slug; every other endpoint is addressed by numeric id,
  // which only arrives with the profile response. The lists below therefore
  // wait on `userId` rather than firing off the URL param directly.
  const { isLoadingProfile, notFound, profile, stats, userId } = useUserProfile(userSlug)
  usePageTitle(profile?.display_name || (notFound ? __('Page not found') : undefined))

  // The rail's rule should run the full height of the window, like the
  // sidebar's, however short the content beside it. The page sits in the
  // layout's scroller with no height of its own to inherit, so it takes the
  // scroller's height as its minimum and follows it as the window resizes.
  const rootRef = useRef<HTMLDivElement>(null)
  const [fillHeight, setFillHeight] = useState<number>()

  useEffect(() => {
    const scroller = getScrollParent(rootRef.current)
    if (!scroller) return

    const measure = () => setFillHeight(scroller.clientHeight)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
    // Re-run once the page leaves its not-found render and the root mounts.
  }, [notFound])

  const { isLoggedIn, user } = useAuthStore()
  const isOwnProfile = Boolean(isLoggedIn && user?.id && Number(user.id) === Number(userId))

  const requested = searchParams.get('tab')
  // Guard the URL as well as the nav: ?tab=manage on someone else's profile
  // falls back rather than rendering something that is not yours.
  const view: View =
    isView(requested) && !(OWNER_ONLY.has(requested) && !isOwnProfile) ? requested : 'overview'

  // Page lives in component state, not the URL: paging within a list is
  // incidental, and writing it to history would put a back-button step between
  // the reader and the page they arrived from.
  const [page, setPage] = useState(1)

  const { isLoadingPermissions, permissions } = useUserPermissions(userId, {
    enabled: Boolean(userId) && isOwnProfile && !notFound
  })

  const isList = LIST_VIEWS.has(view)

  const { isFetchingItems, isLoadingItems, items, pagination } = useUserContent(
    userId,
    isList ? (view as ProfileTab) : 'topics',
    page,
    { enabled: Boolean(userId) && !notFound && isList }
  )

  // Component state for the same reason as `page`: a range is a way of looking
  // at the Overview, not a place worth a history entry.
  const [period, setPeriod] = useState<InsightPeriod>('30d')
  const { insights, isFetchingInsights, isLoadingInsights } = useUserInsights(userId, period, {
    enabled: Boolean(userId) && !notFound && view === 'overview'
  })

  const selectView = (next: View) => {
    setPage(1)
    setSearchParams(
      prev => {
        if (next === 'overview') prev.delete('tab')
        else prev.set('tab', next)
        return prev
      },
      // Replace so moving around a profile doesn't stack history entries
      // between the reader and wherever they came from.
      { replace: true }
    )
  }

  const tabs: TabItem<View>[] = useMemo(() => {
    const list: TabItem<View>[] = [
      { key: 'overview', label: __('Overview') },
      { key: 'topics', label: __('Posts') },
      { key: 'comments', label: __('Comments') }
    ]
    if (isOwnProfile) {
      list.push({ key: 'votes', label: __('Upvotes') }, { key: 'manage', label: __('Manage') })
    }
    return list
  }, [isOwnProfile])

  // Topic cards carry a vote button, so the list needs the same handler the
  // listing page uses.
  const { toggleVote } = usePostsStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const handleVote = async (postId: number) => {
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

  const backLink = (
    <Link
      className="bc-inline-flex bc-w-fit bc-items-center bc-gap-1.5 bc-rounded-full bc-px-2.5 bc-py-1 bc-text-[13px] bc-font-medium bc-text-ink-muted bc-no-underline bc-transition-colors hover:bc-bg-surface-sunken hover:bc-text-ink"
      to="/"
    >
      <LuArrowLeft size={15} />
      {__('Back to portal')}
    </Link>
  )

  if (notFound && !isLoadingProfile) {
    return (
      <div className="bc-flex bc-flex-col bc-gap-3 bc-p-3 lg:bc-p-4">
        {backLink}
        <Empty description={__('This member could not be found.')} />
      </div>
    )
  }

  /** Wrapper giving list rows the same card surface as the rest of the portal. */
  const surface = (children: React.ReactNode) => (
    <div className="bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface">
      {children}
    </div>
  )

  // A function rather than chained ternaries in the JSX: three states (loading,
  // empty, list) read far better as early returns.
  const renderList = () => {
    // Also covers the slug→id resolution: until the profile lands there is no
    // id to query with, and without this the panel would flash its empty state
    // before the first request is even made.
    if (isLoadingProfile || isLoadingItems) {
      return surface(
        <div className="bc-p-4">
          <Skeleton active paragraph={{ rows: 5 }} />
        </div>
      )
    }

    if (items.length === 0) {
      return surface(
        <div className="bc-py-10">
          <Empty
            description={EMPTY_MESSAGE[view as ProfileTab]()}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      )
    }

    const body = (() => {
      if (view === 'comments') {
        return surface(
          (items as UserComment[]).map(comment => (
            <CommentRow comment={comment} key={comment.comment_ID} />
          ))
        )
      }

      return (
        <div className="bc-flex bc-flex-col bc-gap-3">
          {(items as Topic[]).map(topic => (
            <TopicCard key={topic.ID} onVote={handleVote} topic={topic} />
          ))}
        </div>
      )
    })()

    return (
      <motion.div
        // Fade the list on tab/page change so the swap reads as a transition
        // rather than a flash of new content.
        animate={{ opacity: 1, y: 0 }}
        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
        key={`${view}-${page}`}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {body}
      </motion.div>
    )
  }

  const identityCard = (
    <ProfileCard
      canEditAvatar={isOwnProfile}
      isLoading={isLoadingProfile}
      onManage={isOwnProfile ? () => selectView('manage') : undefined}
      profile={profile}
      stats={stats}
    />
  )

  const renderPanel = () => {
    if (view === 'manage') {
      return (
        <ManageSection
          isLoadingPermissions={isLoadingPermissions}
          permissions={permissions}
          profile={profile}
        />
      )
    }

    if (view === 'overview') {
      return (
        <InsightsOverview
          insights={insights}
          isFetching={isFetchingInsights}
          isLoading={isLoadingProfile || isLoadingInsights}
        />
      )
    }

    return (
      <>
        {renderList()}

        {pagination.total > PROFILE_PAGE_SIZE && (
          <div className="bc-mt-4 bc-flex bc-justify-center">
            <Pagination
              current={pagination.current_page}
              disabled={isFetchingItems}
              hideOnSinglePage
              onChange={setPage}
              pageSize={PROFILE_PAGE_SIZE}
              showSizeChanger={false}
              total={pagination.total}
            />
          </div>
        )}
      </>
    )
  }

  return (
    <div
      className="bc-flex bc-flex-col lg:bc-flex-row"
      ref={rootRef}
      style={{ minHeight: fillHeight }}
    >
      {/* Card first in the DOM so it leads on narrow screens, where it stacks
          above the content; `lg:bc-order-2` moves it to the rail on desktop,
          ruled off from the content the way the sidebar is on the left. */}
      <aside className="bc-w-full bc-shrink-0 bc-px-3 bc-pt-3 lg:bc-order-2 lg:bc-w-[380px] lg:bc-border-0 lg:bc-border-l lg:bc-border-solid lg:bc-border-line lg:bc-p-6">
        <div className="lg:bc-sticky lg:bc-top-6">{identityCard}</div>
      </aside>

      {/* The page already sits inside the layout's <main>; a second one would give
          assistive tech two main landmarks to choose between. */}
      <section className="bc-flex bc-min-w-0 bc-flex-1 bc-flex-col bc-gap-4 bc-p-3 lg:bc-order-1 lg:bc-p-6">
        <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
          <TabNav
            activeKey={view}
            ariaLabel={__('Profile sections')}
            idPrefix="profile"
            items={tabs}
            onChange={selectView}
            variant="pill"
          />

          {view === 'overview' && (
            <Select<InsightPeriod>
              aria-label={__('Period')}
              className="bc-min-w-[170px]"
              onChange={setPeriod}
              options={PERIOD_OPTIONS.map(option => ({
                label: option.label(),
                value: option.value
              }))}
              popupMatchSelectWidth={false}
              prefix={<LuCalendar className="bc-text-ink-muted" size={16} />}
              size="large"
              value={period}
            />
          )}
        </div>

        <div aria-labelledby={`profile-tab-${view}`} id={`profile-panel-${view}`} role="tabpanel">
          {renderPanel()}
        </div>
      </section>
    </div>
  )
}
