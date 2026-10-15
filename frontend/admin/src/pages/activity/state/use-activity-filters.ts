import { useSearchParams } from 'react-router'

import { type ActivityFilters, type ActivityPeriod } from '../data/use-activity-log'

const PERIODS = new Set<string>(['7d', '30d', '90d', 'today', 'yesterday'])
const TARGET_TYPES = new Set(['comment', 'post'])
const DEFAULT_PER_PAGE = 20

/** What the screen filters by, plus the actor's name for the chip it shows. */
export interface ActivityView {
  /** Display only — the server filters by id. Kept so a shared link can still name the person. */
  actorName: string
  filters: ActivityFilters
}

const positive = (value: null | string) => {
  const number = Number(value)

  return Number.isInteger(number) && number > 0 ? number : undefined
}

/**
 * Reads the filters from the address rather than from component state.
 *
 * The question a moderator brings here is usually about one topic or one person,
 * and the answer is worth keeping: in the URL it survives a reload and the back
 * button, and "the history of topic #505" becomes a link that can be pasted to
 * another moderator. Anything the address carries that the screen cannot use is
 * dropped here, so a hand-edited link narrows to what it can rather than failing.
 */
function read(params: URLSearchParams): ActivityView {
  const period = params.get('period')
  const targetType = params.get('type')

  return {
    actorName: params.get('actor_name') ?? '',
    filters: {
      action: params.get('action') || undefined,
      actor: positive(params.get('actor')),
      page: positive(params.get('page')) ?? 1,
      per_page: positive(params.get('per_page')) ?? DEFAULT_PER_PAGE,
      period: period && PERIODS.has(period) ? (period as ActivityPeriod) : undefined,
      target_id: positive(params.get('id')),
      target_type: targetType && TARGET_TYPES.has(targetType) ? targetType : undefined
    }
  }
}

function write({ actorName, filters }: ActivityView): URLSearchParams {
  const params = new URLSearchParams()
  const set = (key: string, value: number | string | undefined) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }

  set('action', filters.action)
  set('type', filters.target_type)
  set('id', filters.target_id)
  set('actor', filters.actor)
  if (filters.actor) set('actor_name', actorName)
  set('period', filters.period)
  if ((filters.page ?? 1) > 1) set('page', filters.page)
  if ((filters.per_page ?? DEFAULT_PER_PAGE) !== DEFAULT_PER_PAGE) set('per_page', filters.per_page)

  return params
}

export default function useActivityFilters() {
  const [params, setParams] = useSearchParams()
  const view = read(params)

  /**
   * Any filter change returns to page 1: staying on page 4 of a narrower result
   * set shows an empty list that reads as "nothing happened".
   */
  const setFilter = (patch: Partial<ActivityFilters>, actorName?: string) =>
    setParams(
      write({
        actorName: actorName ?? (patch.actor === undefined && 'actor' in patch ? '' : view.actorName),
        filters: { ...view.filters, ...patch, page: 1 }
      })
    )

  const setPage = (page: number, perPage: number) =>
    setParams(write({ ...view, filters: { ...view.filters, page, per_page: perPage } }))

  const clear = () =>
    setParams(write({ actorName: '', filters: { per_page: view.filters.per_page } }))

  return { ...view, clear, setFilter, setPage }
}
