import { type EditAttributionResponse } from '@/types/edit-attribution'
import { type MemberBadge } from '@/types/member-badge'

export interface TopicComment {
  attachments?: {
    filename: string
    filesize: number
    id: number
    type: string
    url: string
  }[]
  /**
   * Author's profile picture, already resolved server-side to their upload or
   * their Gravatar. Empty when neither could be worked out.
   */
  author_avatar?: string
  /**
   * The author's standing, or null when they are an ordinary member. Carried on
   * this shape rather than only on the comments endpoint because the topic page
   * builds its thread from the topic payload, and a field missing here is a
   * badge nobody sees.
   */
  author_badge?: MemberBadge | null
  /** Author's profile slug. Empty for guests, who have no profile to link to. */
  author_slug?: string
  children: null | TopicComment[]
  comment_approved: string
  comment_author: string
  /*
   * No comment_author_email, comment_author_IP or comment_agent. The server
   * used to send all three on every topic page and nothing here read them.
   */
  comment_author_url: string
  comment_content: string
  comment_date: string
  comment_date_gmt: string
  comment_ID: string
  comment_karma: string
  comment_parent: string
  comment_post_ID: string
  comment_type: string
  /** Who last edited this comment, or null when nobody has. */
  edited?: EditAttributionResponse | null
  /** Held while a moderator reviews a report. Content is a marker, not the words. */
  hidden?: boolean
  isAdmin?: boolean
  populated_children: boolean
  post_fields: string[]
  user_id: string
  vote: {
    hasVoted: boolean
    total: number
  }
}

export interface WordPressComment {
  _links?: Record<string, unknown>
  attachments?: {
    filename: string
    filesize: number
    id: number
    type: string
    url: string
  }[]
  author: number
  author_avatar_urls: {
    '24': string
    '48': string
    '96': string
  }
  author_name: string
  author_url: string
  children?: WordPressComment[]
  content: {
    rendered: string
  }
  date: string
  date_gmt: string
  hasVoted?: boolean
  id: number
  link: string
  meta?: Record<string, unknown>
  parent: number
  post: number
  status: string
  type: string
  votes?: number
}
