import {
  type InfiniteData,
  keepPreviousData,
  type QueryKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import config from '@/config/config'
import get from '@/utils/request/get'
import post from '@/utils/request/post'
import { type ResponseType } from '@/utils/request/types'

/** Everything the server stored about one event, as the row is rendered from. */
export interface NotificationActor {
  avatar: string
  id: number
  /** True when a rule acted rather than a person, e.g. the auto-hide threshold. */
  is_system: boolean
  /** Empty for a deleted account *and* for the system — `is_system` tells them apart. */
  name: string
  slug: string
}

export interface NotificationItem {
  actor: NotificationActor
  /**
   * Stored at dispatch, not looked up now. The row has to still read as a
   * sentence once its target is gone — which is exactly the case for the most
   * important notification the forum sends.
   */
  context: {
    badge_label?: string
    changed?: Record<string, { from: string; to: string }>
    decision_label?: string
    excerpt?: string
    note?: string
    /** The private space asked for, or opened, on an `access_*` row. */
    space_name?: string
    /** The tag a member suggested, on a `tag_suggested` row. */
    tag_name?: string
    topic_title?: string
    url?: string
  }
  /** How many times a collapsed event happened. 1 for everything but votes. */
  count: number
  created_at: string
  id: number
  read: boolean
  target: { exists: boolean; id: number; type: string }
  topic_id: number
  type: string
  type_label: string
}

interface NotificationFeed {
  data: NotificationItem[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    total_pages: number
  }
  /** Sent with every page so the bell and the list can never disagree. */
  unread: number
}

export const NOTIFICATIONS_KEY = 'notifications'

export const UNREAD_KEY = 'notifications-unread'

/** How often the bell asks. Paused entirely while the tab is hidden. */
const POLL_MS = 60_000

/** When the server printed the count the bell starts from. */
const PAGE_LOADED_AT = Date.now()

type UnreadResponse = ResponseType<{ unread: number }>

/** The cache holds the server's envelope, so the seed has to wear it too. */
export const unreadEnvelope = (unread: number) => ({ data: { unread } }) as UnreadResponse

/**
 * The number on the bell.
 *
 * Seeded from the server-rendered config so the badge is correct on first paint
 * rather than popping in a beat after the header draws — the same "sync, no
 * flash" channel the portal's other boot-time values use. The poll then takes
 * over.
 */
export function useUnreadCount() {
  const { data } = useQuery<UnreadResponse, Error, number>({
    enabled: config.IS_LOGGED_IN,
    initialData: unreadEnvelope(config.UNREAD_NOTIFICATIONS),
    // The seed is as new as the page, so it stands until the first poll. It
    // used to count as stale at once, and every page load asked the server for
    // the number it had just printed — a full WordPress load for each member.
    initialDataUpdatedAt: PAGE_LOADED_AT,
    queryFn: ({ signal }) => get<{ unread: number }>('notifications/count', { signal }),
    queryKey: [UNREAD_KEY],
    refetchInterval: POLL_MS,
    // A backgrounded tab is not watching the bell, and a forum left open in one
    // would otherwise ask forever. TanStack pauses the interval when the window
    // loses focus and refetches on return, which is what we want anyway.
    refetchIntervalInBackground: false,
    retry: false,
    select: response => Number(response?.data?.unread ?? 0),
    staleTime: POLL_MS
  })

  return { unreadCount: data ?? 0 }
}

export interface NotificationFilters {
  page?: number
  per_page?: number
  /** Only rows not yet read. */
  unread?: boolean
}

export function useNotifications(filters: NotificationFilters, enabled = true) {
  const { data, isError, isFetching, isPlaceholderData } = useQuery<
    ResponseType<NotificationFeed>,
    Error,
    NotificationFeed
  >({
    enabled: enabled && config.IS_LOGGED_IN,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      get<NotificationFeed>('notifications', {
        queryParam: {
          page: filters.page ?? 1,
          per_page: filters.per_page ?? 10,
          ...(filters.unread ? { unread: 1 } : {})
        },
        signal
      }),
    queryKey: [NOTIFICATIONS_KEY, filters],
    retry: false,
    select: response => response?.data
  })

  return {
    isNotificationsError: isError,
    isNotificationsFetching: isFetching,
    // True only while another page loads behind the one on screen, so opening
    // the panel again does not grey out rows the reader is already looking at.
    isNotificationsStale: isPlaceholderData,
    notifications: data
  }
}

/**
 * The full list, loaded a page at a time as the reader reaches the bottom.
 *
 * Separate from useNotifications() rather than replacing it: the bell's panel
 * shows a fixed handful and has no room to grow, so paying for an infinite
 * query's page bookkeeping there would buy nothing.
 */
export function useInfiniteNotifications(unreadOnly: boolean, perPage = 20) {
  const { data, fetchNextPage, hasNextPage, isError, isFetching, isFetchingNextPage } = useInfiniteQuery<
    ResponseType<NotificationFeed>,
    Error,
    InfiniteData<ResponseType<NotificationFeed>>,
    readonly unknown[],
    number
  >({
    enabled: config.IS_LOGGED_IN,
    getNextPageParam: lastPage => {
      const pagination = lastPage?.data?.pagination

      if (!pagination) return

      // undefined is TanStack's "there is no next page", which is what turns
      // hasNextPage off and stops the sentinel asking again.
      return pagination.current_page < pagination.total_pages ? pagination.current_page + 1 : undefined
    },
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      get<NotificationFeed>('notifications', {
        queryParam: {
          page: pageParam,
          per_page: perPage,
          ...(unreadOnly ? { unread: 1 } : {})
        },
        signal
      }),
    queryKey: [NOTIFICATIONS_KEY, 'infinite', unreadOnly, perPage],
    retry: false
  })

  const pages = data?.pages ?? []

  return {
    hasMore: hasNextPage,
    isNotificationsError: isError,
    // The first load only — `isFetching` is also true while a later page is
    // arriving, and swapping the loaded list for a skeleton at that moment
    // would throw the reader back to the top.
    isLoadingMore: isFetchingNextPage,
    isNotificationsLoading: isFetching && pages.length === 0,
    loadMore: fetchNextPage,
    notifications: pages.flatMap(page => page?.data?.data ?? []),
    // Read off the newest page: every response carries it, and the last one
    // fetched is the freshest answer the client has.
    total: pages[0]?.data?.pagination.total ?? 0
  }
}

interface MarkReadPayload {
  all?: boolean
  ids?: number[]
}

/** What the caches held before an optimistic mark, to put back on failure. */
interface MarkReadContext {
  snapshot: [QueryKey, unknown][]
}

type FeedCache = InfiniteData<ResponseType<NotificationFeed>> | ResponseType<NotificationFeed>

/** A feed page with the given rows shown as read, and its unread total moved to match. */
const markFeedRead = (
  feed: ResponseType<NotificationFeed>,
  isTarget: (item: NotificationItem) => boolean
): ResponseType<NotificationFeed> => {
  if (!feed?.data) return feed

  const marked = feed.data.data.filter(item => !item.read && isTarget(item)).length

  return {
    ...feed,
    data: {
      ...feed.data,
      data: feed.data.data.map(item => (!item.read && isTarget(item) ? { ...item, read: true } : item)),
      unread: Math.max(0, feed.data.unread - marked)
    }
  }
}

/**
 * Marks notifications read.
 *
 * The bell and the rows change at the click, not when the server answers:
 * clearing the bell *is* the receipt for the click, and on a slow site a
 * receipt one round trip late reads as nothing having happened. A failed
 * request puts back what was there, and the refetch after it still runs,
 * because a number moved locally is a guess until the server agrees.
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: (payload: MarkReadPayload) =>
      post<MarkReadPayload, { read: number }>('notifications/read', { body: payload }),
    onError: (_error, _payload, context: MarkReadContext | undefined) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data)
    },
    onMutate: async payload => {
      // A poll landing after this would write the old count back over it.
      await queryClient.cancelQueries({ queryKey: [UNREAD_KEY] })
      await queryClient.cancelQueries({ queryKey: [NOTIFICATIONS_KEY] })

      const snapshot = [
        ...queryClient.getQueriesData({ queryKey: [UNREAD_KEY] }),
        ...queryClient.getQueriesData({ queryKey: [NOTIFICATIONS_KEY] })
      ]

      const ids = new Set(payload.ids ?? [])
      const isTarget = (item: NotificationItem) => Boolean(payload.all) || ids.has(item.id)

      queryClient.setQueryData<UnreadResponse>([UNREAD_KEY], cached => {
        const current = Number(cached?.data?.unread ?? 0)
        const next = payload.all ? 0 : Math.max(0, current - ids.size)

        return unreadEnvelope(next)
      })

      queryClient.setQueriesData<FeedCache>({ queryKey: [NOTIFICATIONS_KEY] }, cached => {
        if (!cached) return cached
        if ('pages' in cached) {
          return { ...cached, pages: cached.pages.map(page => markFeedRead(page, isTarget)) }
        }

        return markFeedRead(cached, isTarget)
      })

      return { snapshot } satisfies MarkReadContext
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: [UNREAD_KEY] })
      ])
  })

  return { isMarkingRead: isPending, markRead: mutateAsync }
}
