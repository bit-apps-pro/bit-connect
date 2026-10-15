import { type ReactNode } from 'react'

/** A status, stage or type a topic is filed under, as a row carries it. */
export interface RowTerm {
  color?: null | string
  id: number
  name: string
  slug: string
}

/** One topic as the moderation table lists it — its state, not its words. */
export interface ModerationTopicRow {
  author: { avatar: string; id: number; name: string }
  comments_count: number
  created_at: string
  hidden: boolean
  id: number
  is_locked: boolean
  is_pinned: boolean
  permalink: string
  post_status: string
  stage: null | RowTerm
  status: null | RowTerm
  /** Each added taxonomy's term, keyed by its request parameter. */
  terms: Record<string, null | { id: number; name: string }>
  title: string
  topic_type: null | RowTerm
}

export interface ModerationTopicsPage {
  data: ModerationTopicRow[]
  pagination: {
    current_page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export interface TopicFilters {
  author?: number
  order?: 'asc' | 'desc'
  orderby?: 'comment_count' | 'date' | 'modified' | 'title'
  page: number
  per_page: number
  search?: string
  stage?: number
  status?: number
  /** Terms of the taxonomies another plugin adds, keyed by parameter. */
  terms?: Record<string, number | undefined>
  topic_type?: number
  visibility?: 'hidden' | 'private' | 'public'
}

export type BulkAction =
  | 'delete'
  | 'hide'
  | 'lock'
  | 'pin'
  | 'restore'
  | 'set_stage'
  | 'set_status'
  | 'unlock'
  | 'unpin'

export interface BulkResult {
  counts: { done: number; failed: number; skipped: number }
  results: { id: number; outcome: 'done' | 'failed' | 'skipped' }[]
}

/** Which of the row actions the signed-in moderator may take. */
export interface TopicAbilities {
  delete_any: boolean
  lock: boolean
  pin: boolean
}

/** A taxonomy another plugin files topics under, as a filter. */
export interface FilterTaxonomy {
  label: string
  param: string
  terms: { id: number; name: string }[]
}

/** Something the table can do to the selected topics, or to one of them. */
export interface TopicAction {
  /** Asked before running; omitted, it runs at once. */
  confirm?: string
  danger?: boolean
  icon?: ReactNode
  key: string
  label: string
  run: (ids: number[]) => Promise<unknown>
}

/**
 * A further named list of topics, beside the table's own, sent to the server
 * as `view`. It may bring the actions that fit its topics; without them the
 * table offers its own.
 */
export interface TopicListView {
  bulkActions?: TopicAction[]
  icon?: ReactNode
  label: string
  rowActions?: TopicAction[]
  value: string
}
