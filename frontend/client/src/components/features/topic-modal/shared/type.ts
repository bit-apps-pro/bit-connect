import { type EditAttributionResponse } from '@/types/edit-attribution'
import { type MemberBadge } from '@/types/member-badge'

/**
 * Term meta as the server sends it. The keys the portal reads are typed; the
 * rest is whatever the admin screens have stored against the term.
 */
/**
 * How many tags a topic may carry. The server's PostingLimits::TOPIC_TAGS_CEILING,
 * which the topic requests enforce; this is what lets the picker say so first.
 */
export const MAX_TAGS_PER_TOPIC = 5

export interface TermMeta {
  [key: string]: unknown
  color?: string
  icon?: string
  is_default?: boolean
  order?: number
}

export interface Term {
  count: number
  description: string
  filter: string
  meta: TermMeta
  name: string
  parent: number
  /** A tag a member suggested that an administrator has not yet approved. */
  pending?: boolean
  slug: string
  taxonomy: string
  term_group: number
  term_id: number
  term_taxonomy_id: number
}

/** The term lists this plugin files a topic under itself. */
const OWN_TERM_KEYS = new Set(['stages', 'statuses', 'tags', 'topic_types'])

/**
 * The term a topic carries in each taxonomy a plugin adds, by the parameter
 * the server returns it under — see TopicTaxonomies.php. Empty when it carries
 * none, which is always the case without such a plugin.
 */
export function addedTerms(terms: Topic['terms'] | undefined): Record<string, Term> {
  return Object.fromEntries(
    Object.entries(terms ?? {}).filter(
      (entry): entry is [string, Term] => !OWN_TERM_KEYS.has(entry[0]) && !!entry[1] && !Array.isArray(entry[1])
    )
  )
}

export interface TopicAttachmentInfo {
  filename: string
  filesize: number
  id: number
  type: string
  url: string
}

/**
 * Normalize attachments from API response.
 * Handles both new array format [{id, filename, ...}]
 * and old WP object format {"123": {ID, guid, post_title, ...}}
 */
export function normalizeAttachments(attachments: unknown): TopicAttachmentInfo[] {
  if (!attachments) return []

  // New format: already an array of {id, filename, filesize, type, url}
  if (Array.isArray(attachments)) {
    return attachments.filter(
      (a): a is TopicAttachmentInfo => typeof a === 'object' && a !== null && ('id' in a || 'ID' in a)
    )
  }

  // Old format: Record<string, TopicAttachment> from get_attached_media()
  if (typeof attachments === 'object') {
    return Object.values(attachments as Record<string, Record<string, unknown>>).map(att => ({
      filename: String(att.post_title || att.filename || 'Unknown'),
      filesize: Number(att.filesize || 0),
      id: Number(att.ID || att.id || 0),
      type: String(att.post_mime_type || att.type || ''),
      url: String(att.guid || att.url || '')
    }))
  }

  return []
}

export interface SaveTopicPayload {
  /** A term of a taxonomy a plugin adds, under its parameter — see TopicTaxonomies.php. */
  [param: string]: number | number[] | string | string[] | undefined
  attachments: number[]
  post_content: string
  /** Optional custom permalink. Blank lets the server derive one from the title. */
  post_name?: string
  post_status?: string
  post_title: string
  /** Ids of tags from the list (as digit strings) and names of tags the member typed — see TagResolverService.php. */
  tags?: string[]
  'topic-types'?: number
  topic_id?: number
}

export interface Topic {
  attachments: TopicAttachmentInfo[]
  author_avatar: string
  /** The author's standing, or null when they are an ordinary member. */
  author_badge?: MemberBadge | null
  author_name: string
  /** Profile slug for linking to the author. Empty for authorless records. */
  author_slug: string
  comment_count: string
  comment_status: string
  comments_count: string
  /** Who last edited this topic's words, or null when nobody has. */
  edited?: EditAttributionResponse | null
  filter: string
  /**
   * Whether the reader is subscribed to this thread.
   *
   * Only sent on the single-topic view — building it costs a query, and no card
   * in the listing draws a Follow button. Absent everywhere else, which is why
   * it is optional rather than defaulted server-side.
   */
  following?: {
    following: boolean
    muted: boolean
    source: string
  }
  guid: string
  /**
   * Out of public view while a moderator reviews a report.
   *
   * Only ever true for the two people served a hidden topic at all — its author
   * and a moderator. Everybody else gets a 404, so this is never a way to learn
   * that someone else's topic was reported.
   */
  hidden?: boolean
  ID: number
  /** A moderator closed the thread: its comments stay readable, but nobody can add one. */
  is_locked?: boolean
  menu_order: number
  permalink: string
  ping_status: string
  pinged: string
  post_author: string
  post_content: string
  post_content_filtered: string
  post_date: string
  post_date_gmt: string
  post_excerpt: string
  post_mime_type: string
  post_modified: string
  post_modified_gmt: string
  post_name: string
  post_parent: number
  post_password: string
  post_status: string
  post_title: string
  post_type: string
  // A topic need not have a term in every taxonomy — the server sends null for
  // the ones it has none in, including in the SSR state the first render uses.
  terms: {
    /** One term of a taxonomy a plugin adds, under its parameter — see TopicTaxonomies.php. */
    [param: string]: null | Term | Term[] | undefined
    stages: null | Term
    statuses: null | Term
    tags: Term[]
    topic_types: null | Term
  }
  to_ping: string
  vote: {
    hasVoted: boolean
    total: number
  }
}
