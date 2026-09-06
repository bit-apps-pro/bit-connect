import { request } from '@common/request'
import { type QueryParam, type ResponseType } from '@common/request/types'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

/** A member named on a log row. Fields are empty when the account is gone. */
export interface ActivityPerson {
  id: number
  /** True on the actor of something the plugin did by rule — the auto-hide. */
  is_system?: boolean
  name: string
  slug?: string
}

export interface ActivityRow {
  action: string
  action_label: string
  actor: ActivityPerson
  /** Free-form per action: before/after text, titles, replies_lost. */
  context: Record<string, unknown>
  created_at: string
  id: number
  reason: string
  target: {
    author: ActivityPerson
    /** False once the topic or comment is gone — the case the log exists for. */
    exists: boolean
    id: number
    type: string
  }
}

interface ActivityLogResponse {
  data: ActivityRow[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export interface ActivityFilters {
  action?: string
  actor?: number
  page?: number
  per_page?: number
  /** One topic or comment id — the history of a single piece of content. */
  target_id?: number
  target_type?: string
}

/**
 * Drops unset filters rather than sending them empty.
 *
 * The server treats an empty action or target_type as "no filter", but an
 * explicitly sent empty string would still have to be validated against the
 * enum on arrival — cheaper and clearer not to send it.
 */
function toQueryParam(filters: ActivityFilters): QueryParam {
  const query: QueryParam = {}

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '' && value !== 0) query[key] = value as number | string
  }

  return query
}

export default function useActivityLog(filters: ActivityFilters) {
  const { data, isError, isFetching } = useQuery<
    ResponseType<ActivityLogResponse>,
    Error,
    ActivityLogResponse
  >({
    // Without this the table empties on every page or filter change and the
    // layout jumps; the previous page stays put until the next one arrives.
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      request<never, ActivityLogResponse>('activity-log', {
        method: 'GET',
        queryParam: toQueryParam(filters),
        signal
      }),
    queryKey: ['activity-log', filters],
    retry: false,
    select: response => response?.data
  })

  return {
    activityLog: data,
    isActivityLogError: isError,
    isActivityLogFetching: isFetching
  }
}

/** Action slugs and labels, read from the server so the enum stays in one place. */
export function useActivityActions() {
  const { data } = useQuery<
    ResponseType<{ label: string; value: string }[]>,
    Error,
    { label: string; value: string }[]
  >({
    queryFn: ({ signal }) =>
      request<never, { label: string; value: string }[]>('activity-log/actions', {
        method: 'GET',
        signal
      }),
    queryKey: ['activity-log-actions'],
    retry: false,
    select: response => response?.data
  })

  return { activityActions: data ?? [] }
}
