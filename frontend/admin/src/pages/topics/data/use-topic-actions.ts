import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'

import { type BulkAction, type BulkResult, type ModerationTopicRow, type ModerationTopicsPage } from '../shared/types'
import { MODERATION_TOPICS_KEY } from './use-moderation-topics'

/** Most topics one bulk request may carry — BulkTopicActionRequest::MAX_IDS. */
export const BULK_CHUNK = 50

/** What one row's edit sends to the topic endpoint. */
export interface TopicPatch {
  is_locked?: boolean
  is_pinned?: boolean
  stages?: number
  statuses?: number
}

/**
 * Runs one action over any number of topics, in requests the server accepts,
 * and adds up what came back.
 */
export async function runBulk(action: BulkAction, ids: number[], termId?: number): Promise<BulkResult> {
  const total: BulkResult = { counts: { done: 0, failed: 0, skipped: 0 }, results: [] }

  for (let start = 0; start < ids.length; start += BULK_CHUNK) {
    const response = await request<object, BulkResult>('moderation/topics/bulk', {
      body: { action, ids: ids.slice(start, start + BULK_CHUNK), ...(termId ? { term_id: termId } : {}) },
      method: 'POST'
    })
    const part = response?.data

    total.counts.done += part?.counts?.done ?? 0
    total.counts.failed += part?.counts?.failed ?? 0
    total.counts.skipped += part?.counts?.skipped ?? 0
    total.results.push(...(part?.results ?? []))
  }

  return total
}

/** A row as it will read once the patch is saved — for the optimistic update. */
function patched(row: ModerationTopicRow, patch: TopicPatch): ModerationTopicRow {
  return {
    ...row,
    ...(patch.is_pinned === undefined ? {} : { is_pinned: patch.is_pinned }),
    ...(patch.is_locked === undefined ? {} : { is_locked: patch.is_locked })
  }
}

/**
 * Changes one topic from its row, through the same endpoint the portal's topic
 * page uses. Pin and lock flip on screen at once; status and stage show the
 * picked value through the select itself until the refetch lands.
 */
export function useUpdateTopic() {
  const queryClient = useQueryClient()

  const { mutateAsync } = useMutation<
    unknown,
    unknown,
    { id: number; patch: TopicPatch },
    [QueryKey, ResponseType<ModerationTopicsPage> | undefined][]
  >({
    mutationFn: ({ id, patch }) =>
      request<TopicPatch, unknown>(`topics/${id}`, { body: patch, method: 'POST' }),
    onError: (_error, _variables, previous) => {
      for (const [key, value] of previous ?? []) queryClient.setQueryData(key, value)
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: MODERATION_TOPICS_KEY })
      const previous = queryClient.getQueriesData<ResponseType<ModerationTopicsPage>>({
        queryKey: MODERATION_TOPICS_KEY
      })

      queryClient.setQueriesData<ResponseType<ModerationTopicsPage>>({ queryKey: MODERATION_TOPICS_KEY }, cached =>
        cached?.data?.data
          ? {
              ...cached,
              data: { ...cached.data, data: cached.data.data.map(row => (row.id === id ? patched(row, patch) : row)) }
            }
          : cached
      )

      return previous
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MODERATION_TOPICS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['activity-log'] })
      ])
  })

  return { updateTopic: mutateAsync }
}

/** Runs a bulk action, then refreshes the table and the activity log. */
export function useBulkTopicAction() {
  const queryClient = useQueryClient()

  const { isPending, mutateAsync } = useMutation({
    mutationFn: ({ action, ids, termId }: { action: BulkAction; ids: number[]; termId?: number }) =>
      runBulk(action, ids, termId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: MODERATION_TOPICS_KEY }),
        queryClient.invalidateQueries({ queryKey: ['activity-log'] })
      ])
  })

  return { isBulkRunning: isPending, runBulkAction: mutateAsync }
}
