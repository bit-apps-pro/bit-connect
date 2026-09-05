import { type EditAttribution } from '@/types/edit-attribution'
import { type MemberBadge } from '@/types/member-badge'

export interface CommentAttachment {
  filename: string
  filesize: number
  id: number
  type: string
  url: string
}

export interface Comment {
  attachments?: CommentAttachment[]
  avatar: string
  /** The author's standing. Absent for ordinary members, who carry no badge. */
  badge?: MemberBadge
  content: string
  createdAt?: string
  /** Who last edited this comment. Absent when nobody has. */
  edited?: EditAttribution
  hasVoted?: boolean
  /** Held while a moderator reviews a report. */
  hidden?: boolean
  id: number
  isAdmin: boolean
  parentId?: number
  replies: Comment[]
  user: string
  userId?: number
  /** Author's profile slug. Empty for guest comments, which have no profile. */
  userSlug?: string
  votes: number
}
