import NotifyContext from '@common/context/NotifyContext'
import { cn } from '@common/helpers/globalHelpers'
import { __, sprintf } from '@common/helpers/i18nWrap'
import queryRequest, { type Response as ApiResponse } from '@common/helpers/request'
import usePageTitle from '@common/hooks/usePageTitle'
import { useFollowTarget } from '@features/notifications/data/use-follow-topic'
import { type TaxonomyTerm } from '@features/topic-modal/data/use-taxonomies'
import { type Topic } from '@features/topic-modal/shared/type'
import { useQueries, useQuery } from '@tanstack/react-query'
import TopicCard from '@utilities/topic-card'
import { archivePath } from '@utils/listing-path'
import { routePath } from '@utils/route-path'
import { Button, Pagination, Skeleton } from 'antd'
import { type ReactNode, useContext, useState } from 'react'
import { LuBellOff, LuBookmarkCheck, LuHash, LuMessagesSquare } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import config, { type PortalArchive } from '@/config/config'
import { type TopicsPagination } from '@/store/data/fetch-all-posts-api'
import { usePostsStore } from '@/store/posts.zustand'
import { useTaxonomiesStoreSelect } from '@/store/use-taxonomies-store'
import get from '@/utils/request/get'
import useChipProps from '@/utils/use-chip-props'

const PAGE_SIZE = 10

/** The most terms of one kind the Tags tab lists. */
const TERM_LIMIT = 100

/**
 * A term's tint, picked from its id so it keeps one colour on every visit —
 * the same palette boards are drawn with.
 */
const HUES = ['#2563EB', '#EA580C', '#059669', '#7C3AED', '#DB2777', '#D97706', '#0891B2']

type Tab = 'tags' | 'topics'

interface FollowedTerm {
  archive: PortalArchive
  term: TaxonomyTerm
}

/** The archives whose terms can be followed: tags, and any a plugin adds. */
const FOLLOWABLE = Object.values(config.PORTAL_ARCHIVES).filter(archive => archive.follow !== '')

/**
 * One page of the topics the member follows.
 *
 * Keyed under `user-content` so a vote cast on a card here flips the cached
 * copy the way it does on a profile tab — see topic-vote-sync.
 */
function useFollowedTopics(page: number) {
  const { data, isFetching, isLoading } = useQuery({
    enabled: config.IS_LOGGED_IN,
    placeholderData: previous => previous,
    queryFn: async ({ signal }) =>
      queryRequest<{ data: Topic[]; pagination: TopicsPagination }>(
        'topics',
        {},
        { followed: 'true', page, per_page: PAGE_SIZE },
        'GET',
        { signal }
      ),
    queryKey: ['user-content', 'following', page],
    select: (res: ApiResponse<{ data: Topic[]; pagination: TopicsPagination }>) => res?.data
  })

  return {
    isFetching,
    isLoading,
    pagination: data?.pagination,
    topics: data?.data ?? []
  }
}

/**
 * Every term the member follows, across the followable archives.
 *
 * Under `follows`, which a follow toggle invalidates — so a term unfollowed
 * from its card here drops off the list.
 */
function useFollowedTerms() {
  const taxonomies = useTaxonomiesStoreSelect()
  const results = useQueries({
    queries: FOLLOWABLE.map(archive => ({
      enabled: config.IS_LOGGED_IN,
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        get<{ data: { target_id: number }[] }>('follows', {
          queryParam: { per_page: TERM_LIMIT, target_type: archive.follow },
          signal
        }),
      queryKey: ['follows', 'mine', archive.follow]
    }))
  })

  const terms: FollowedTerm[] = FOLLOWABLE.flatMap((archive, index) => {
    const known = taxonomies?.[archive.taxonomy] ?? []

    return (results[index]?.data?.data?.data ?? [])
      .map(row => known.find(term => term.id === row.target_id))
      .filter((term): term is TaxonomyTerm => term !== undefined)
      .map(term => ({ archive, term }))
  })

  return { isLoading: results.some(result => result.isLoading), terms }
}

/**
 * What the member follows: the topics, and the tags (or other terms) whose new
 * topics they hear about.
 *
 * Laid out like the portal's other lists — the topic cards the listing uses,
 * and terms as a grid of cards like Browse boards — so following something
 * never looks like a different app.
 */
export default function FollowingPage() {
  usePageTitle(__('Following'))
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('topics')
  const [page, setPage] = useState(1)
  const topics = useFollowedTopics(page)
  const terms = useFollowedTerms()

  return (
    <div className="bc-flex bc-flex-col bc-gap-5 bc-p-4 sm:bc-p-3 lg:bc-p-6">
      <header className="bc-flex bc-flex-col bc-gap-1">
        <h1 className="bc-m-0 bc-text-2xl bc-font-semibold bc-text-ink">{__('Following')}</h1>
        <p className="bc-m-0 bc-text-sm bc-text-ink-muted">
          {__('Topics and tags you follow. You are notified when they get new activity.')}
        </p>
      </header>

      {config.IS_LOGGED_IN ? (
        <>
          <div aria-label={__('Following')} className="bc-flex bc-flex-wrap bc-items-center bc-gap-2" role="group">
            <Chip
              count={topics.pagination?.total}
              isActive={tab === 'topics'}
              label={__('Topics')}
              onClick={() => setTab('topics')}
            />
            <Chip
              count={terms.isLoading ? undefined : terms.terms.length}
              isActive={tab === 'tags'}
              label={__('Tags')}
              onClick={() => setTab('tags')}
            />
          </div>

          {tab === 'topics' ? (
            <TopicsTab onPage={setPage} {...topics} />
          ) : (
            <TermsTab isLoading={terms.isLoading} terms={terms.terms} />
          )}
        </>
      ) : (
        <EmptyState
          action={
            // Through the router, not href: a router path is relative to the
            // portal, and as a plain link it opened the site's own /login.
            <Button onClick={() => navigate(routePath(`/login?redirect_to=${encodeURIComponent('/following')}`))} type="primary">
              {__('Sign in')}
            </Button>
          }
          icon={<LuBookmarkCheck size={22} />}
          text={__('Sign in to see the topics and tags you follow.')}
        />
      )}
    </div>
  )
}

/** The listing's own filter chip, with a count. */
function Chip({
  count,
  isActive,
  label,
  onClick
}: {
  count?: number
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={isActive}
      className={cn([
        'bc-inline-flex bc-h-8 bc-shrink-0 bc-cursor-pointer bc-items-center bc-gap-1.5 bc-whitespace-nowrap bc-rounded-md bc-border bc-border-solid bc-px-3 bc-text-sm bc-transition-colors',
        'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40',
        isActive
          ? 'bc-border-primary/30 bc-bg-primary/10 bc-font-medium bc-text-primary'
          : 'bc-border-line bc-bg-surface bc-text-ink-muted hover:bc-border-line-strong hover:bc-text-ink'
      ])}
      onClick={onClick}
      type="button"
    >
      {label}
      {count !== undefined && <span className="bc-text-xs bc-opacity-70">{count}</span>}
    </button>
  )
}

function TopicsTab({
  isFetching,
  isLoading,
  onPage,
  pagination,
  topics
}: ReturnType<typeof useFollowedTopics> & { onPage: (page: number) => void }) {
  const { toggleVote } = usePostsStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const { notificationApi } = useContext(NotifyContext)
  const navigate = useNavigate()

  const handleVote = async (postId: number) => {
    if (!config.IS_LOGGED_IN) {
      openLoginWarning()
      return
    }

    try {
      await toggleVote(postId)
    } catch {
      notificationApi?.error({ message: __('Failed to vote on post') })
    }
  }

  if (isLoading) return <CardSkeletons />

  if (topics.length === 0) {
    return (
      <EmptyState
        action={<Button onClick={() => navigate(routePath('/'))}>{__('Browse topics')}</Button>}
        icon={<LuMessagesSquare size={22} />}
        text={__('You are not following any topics yet. Follow one from its page, or take part in it.')}
      />
    )
  }

  return (
    <>
      <div className="bc-flex bc-flex-col bc-gap-4">
        {topics.map(topic => (
          <TopicCard key={topic.ID} onVote={handleVote} showStage topic={topic} />
        ))}
      </div>
      {pagination && pagination.total > PAGE_SIZE && (
        <div className="bc-flex bc-justify-center">
          <Pagination
            current={pagination.current_page}
            disabled={isFetching}
            hideOnSinglePage
            onChange={onPage}
            pageSize={PAGE_SIZE}
            showSizeChanger={false}
            total={pagination.total}
          />
        </div>
      )}
    </>
  )
}

function TermsTab({ isLoading, terms }: { isLoading: boolean; terms: FollowedTerm[] }) {
  const navigate = useNavigate()

  if (isLoading) return <CardSkeletons grid />

  if (terms.length === 0) {
    return (
      <EmptyState
        action={<Button onClick={() => navigate(routePath('/'))}>{__('Browse topics')}</Button>}
        icon={<LuHash size={22} />}
        text={__('You are not following any tags yet. Open a tag and follow it to hear about its new topics.')}
      />
    )
  }

  return (
    <div className="bc-grid bc-gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {terms.map(followed => (
        <TermCard key={`${followed.archive.follow}-${followed.term.id}`} {...followed} />
      ))}
    </div>
  )
}

/** One followed term, drawn like a board card: its mark, name, count and actions. */
function TermCard({ archive, term }: FollowedTerm) {
  const { chipColors } = useChipProps()
  const tint = chipColors(HUES[Math.abs(term.id) % HUES.length])
  const navigate = useNavigate()
  const to = archivePath(archive.filter, term.slug)
  const isTag = archive.filter === 'tags'

  const count =
    term.count === 1
      ? __('1 topic')
      : // translators: %d: how many topics the tag has.
        sprintf(__('%d topics'), term.count)

  return (
    <article className="bc-flex bc-flex-col bc-gap-3 bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4">
      <div className="bc-flex bc-items-center bc-gap-3">
        <span
          aria-hidden
          className="bc-flex bc-shrink-0 bc-items-center bc-justify-center bc-rounded-lg"
          style={{ background: tint?.backgroundColor, color: tint?.color, height: 48, width: 48 }}
        >
          <LuHash size={22} />
        </span>
        <div className="bc-min-w-0">
          <h2 className="bc-m-0 bc-truncate bc-text-base bc-font-semibold">
            <Link className="bc-text-ink" to={to}>
              {term.name}
            </Link>
          </h2>
          <p className="bc-m-0 bc-text-sm bc-text-ink-muted">{isTag ? count : `${archive.label} · ${count}`}</p>
        </div>
      </div>

      {term.description !== '' && (
        <p className="bc-m-0 bc-line-clamp-2 bc-text-sm bc-leading-relaxed bc-text-ink-muted">{term.description}</p>
      )}

      <div className="bc-mt-auto bc-flex bc-gap-2">
        <Button block onClick={() => navigate(to)}>
          {__('View topics')}
        </Button>
        <UnfollowButton archive={archive} term={term} />
      </div>
    </article>
  )
}

/**
 * Stops following a term. Starts from "following" — it is on this page because
 * the member follows it — so no request is made to ask.
 */
function UnfollowButton({ archive, term }: FollowedTerm) {
  const { notificationApi } = useContext(NotifyContext)
  const { isTogglingFollow, toggleFollow } = useFollowTarget(archive.follow, term.id, {
    following: true,
    muted: false,
    source: ''
  })

  return (
    <Button
      aria-label={sprintf(__('Unfollow %s'), term.name)}
      icon={<LuBellOff size={15} />}
      loading={isTogglingFollow}
      onClick={() =>
        toggleFollow(false).then(
          () => notificationApi?.success({ message: sprintf(__('Unfollowed “%s”'), term.name) }),
          () => notificationApi?.error({ message: __('Could not change your follow setting.') })
        )
      }
      title={__('Unfollow')}
    />
  )
}

function EmptyState({ action, icon, text }: { action?: ReactNode; icon: ReactNode; text: string }) {
  return (
    <div className="bc-flex bc-flex-col bc-items-center bc-gap-3 bc-rounded-lg bc-border bc-border-dashed bc-border-line bc-bg-surface bc-px-6 bc-py-12 bc-text-center">
      <span className="bc-flex bc-h-12 bc-w-12 bc-items-center bc-justify-center bc-rounded-full bc-bg-primary/10 bc-text-primary">
        {icon}
      </span>
      <p className="bc-m-0 bc-max-w-md bc-text-sm bc-text-ink-muted">{text}</p>
      {action}
    </div>
  )
}

function CardSkeletons({ grid = false }: { grid?: boolean }) {
  const card = (key: number) => (
    <div className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4" key={key}>
      <Skeleton active avatar={grid} paragraph={{ rows: grid ? 1 : 2 }} />
    </div>
  )

  return grid ? (
    <div className="bc-grid bc-gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {[0, 1, 2].map(card)}
    </div>
  ) : (
    <div className="bc-flex bc-flex-col bc-gap-4">{[0, 1, 2].map(card)}</div>
  )
}
