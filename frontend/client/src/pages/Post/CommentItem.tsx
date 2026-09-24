import { DownOutlined, EllipsisOutlined, MessageOutlined, UpOutlined } from '@ant-design/icons'
import { __ } from '@common/helpers/i18nWrap'
import { mentionHtml } from '@components/quilTextEditor/mention-html'
import { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import { useReportModalStore } from '@features/report-modal'
import { commentAnchorId, ShareButton } from '@features/share'
import EditedNote from '@utilities/edited-note'
import MemberBadge from '@utilities/member-badge'
import { userProfilePath } from '@utilities/user-link'
import { App as AntApp, Avatar, Button, Dropdown, type MenuProps, Modal } from 'antd'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { type ReactNode, useEffect, useState } from 'react'
import { LuEyeOff, LuPin } from 'react-icons/lu'
import { Link } from 'react-router'

import { parseMaybeGmt, timeAgo } from '@/common/helpers/globalHelpers'
import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import { useAuthStore } from '@/store/auth.zustand'
import { type Comment } from '@/types/post'
import { flattenReplies, getVisualDepth, MAX_VISUAL_DEPTH, repliesContain } from '@/utils/commentTree'

import CommentEditor from './CommentEditor'
import styles from './CommentThread.module.css'
import ContentBox from './ContentBox'
import useCommentPinItem from './data/use-comment-pin-item'
import AttachmentList from './ui/attachment-list'

interface CommentItemProps {
  comment: Comment
  depth?: number
  /** The comment a `#comment-N` link asked for, if the page was opened with one. */
  focusedCommentId?: number
  onDelete?: (commentId: number) => void
  onEdit?: (commentId: number, content: string, attachments?: WPAttachmentData[]) => void
  onReply?: (commentId: number, content: string, attachments?: WPAttachmentData[]) => void
  /** Draws the upvote control for this reply, when the forum offers one. */
  renderVote?: (comment: Comment) => ReactNode
  replyParentId?: number
  /** Who opened the topic — the only member who may pin a reply in it. */
  topicAuthorId: number
  topicSlug: string
  topicTitle: string
}

export default function CommentItem({
  comment,
  depth = 0,
  focusedCommentId,
  onDelete,
  onEdit,
  onReply,
  renderVote,
  replyParentId,
  topicAuthorId,
  topicSlug,
  topicTitle
}: CommentItemProps) {
  const [showReplyEditor, setShowReplyEditor] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [repliesCollapsed, setRepliesCollapsed] = useState(true)

  const isFocused = focusedCommentId === comment.id

  // A link to a buried reply has to open the branch it sits on, or the target
  // is never rendered for the page to scroll to. Only the ancestors of the
  // target unfold — every other thread stays as the reader would have found it.
  // Not folded back up afterwards: closing the branch under someone who has
  // just been sent there would take the reply away again.
  const holdsFocus = focusedCommentId !== undefined && repliesContain(comment.replies, focusedCommentId)
  useEffect(() => {
    if (holdsFocus) setRepliesCollapsed(false)
  }, [holdsFocus])
  const { can, isLoggedIn, user } = useAuthStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const { open: openReport } = useReportModalStore()
  const shouldReduceMotion = useReducedMotion()

  // Collapsing still needs to change height (that is the layout), but users who
  // ask for reduced motion get the change applied instantly rather than tweened.
  const collapseTransition = shouldReduceMotion
    ? { duration: 0 }
    : { height: { duration: 0.25, ease: 'easeInOut' }, opacity: { duration: 0.2 } }

  const app = AntApp.useApp()

  const handleReply = (content: string, attachments?: WPAttachmentData[]) => {
    if (onReply) {
      onReply(replyParentId ?? comment.id, content, attachments)
    }
    setShowReplyEditor(false)
  }

  const handleEdit = (content: string, attachments?: WPAttachmentData[]) => {
    if (onEdit) {
      onEdit(comment.id, content, attachments)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleDelete = () => {
    // The context-aware modal follows the portal theme; the static one is the
    // fallback for a render outside AppRoutes (tests), where no App exists.
    const confirm = app.modal?.confirm ?? Modal.confirm
    confirm({
      cancelText: __('Cancel'),
      content: 'This will permanently delete this comment and all its replies.',
      okButtonProps: { danger: true },
      okText: __('Delete'),
      onOk: () => {
        if (onDelete) {
          onDelete(comment.id)
        }
      },
      title: __('Delete comment?')
    })
  }

  const hasReplies = comment.replies && comment.replies.length > 0
  const showReplies = hasReplies && !repliesCollapsed
  const visualDepth = getVisualDepth(depth)
  const avatarSizes: Record<number, number> = { 0: 36, 1: 28, 2: 24, 3: 22 }
  const avatarSize = avatarSizes[visualDepth] ?? 22

  // Same rule the server applies in CommentController. The two halves are not
  // symmetrical and that is the design: bit_connect_forum_delete_any removes anyone's
  // reply, while editing never leaves the author. A moderator who thinks a
  // reply has to go removes it; nothing rewrites it in the author's name.
  const isOwner = user?.id && comment.userId && user.id === comment.userId
  const canEdit = Boolean(isOwner && can('bit_connect_forum_edit_own_comment'))
  const canDelete = can('bit_connect_forum_delete_any') || Boolean(isOwner && can('bit_connect_forum_delete_own_comment'))

  // A reply opens with the author already named. Under a nested thread "Reply"
  // is ambiguous on its own: the answer lands beside three others, and past the
  // depth limit it is re-parented to an ancestor entirely — so the layout says
  // who was answered right up until the point where it stops saying it. The
  // mention says it in the words, which is also the only place it can still be
  // said there: the reply now belongs to the ancestor, and the mention is what
  // reaches the person it was actually for.
  //
  // It raises nothing extra on an ordinary reply. CommentController::notifyThread
  // drops whoever was replied to from the mention's recipients, having counted
  // them as told once already.
  //
  // Two people get no mention: a guest, who has no profile for the link to
  // point at, and yourself — a reply to your own comment addressed to you is
  // noise, and the actor is dropped from every notification anyway.
  const replyMention =
    comment.userSlug && !isOwner
      ? mentionHtml({ name: comment.user, slug: comment.userSlug })
      : undefined

  // Nothing on a free install: the dispatch resolves to an implementation that
  // returns no entry at all. Called unconditionally and before the menu is
  // assembled, because it is a hook — which implementation runs is fixed at
  // build time, but that it runs cannot be.
  const pinMenuItem = useCommentPinItem({ comment, topicAuthorId })

  // On mobile, Edit/Delete are collapsed into a single "More" (⋯) menu
  // (text-only items, no icons).
  const moreMenuItems: MenuProps['items'] = []

  // First in the menu. Pinning is the topic author's own judgement about their
  // own thread, and it sits above the entries that act on the reply itself.
  if (pinMenuItem) {
    moreMenuItems.push(pinMenuItem)
  }

  if (canEdit) {
    moreMenuItems.push({
      key: 'edit',
      label: __('Edit'),
      onClick: () => setIsEditing(true)
    })
  }
  if (canDelete) {
    moreMenuItems.push({
      danger: true,
      key: 'delete',
      label: __('Delete'),
      onClick: handleDelete
    })
  }

  // Reporting is for other people's replies: the author of a comment can edit
  // or delete it, and the server refuses a report on your own content anyway.
  // Guests get the login prompt rather than a dead menu entry.
  if (!isOwner && !comment.hidden) {
    moreMenuItems.push({
      key: 'report',
      label: __('Report'),
      onClick: () =>
        isLoggedIn
          ? openReport({ excerpt: comment.content, id: comment.id, type: 'comment' })
          : openLoginWarning()
    })
  }

  return (
    // The id is what `#comment-N` lands on. `comment-{id}` is WordPress's own
    // fragment, so links the server wrote long before the portal answered to
    // them — notification targets, report links — resolve here too.
    <div className={styles.thread} data-depth={visualDepth} id={commentAnchorId(comment.id)}>
      {/* Comment row: avatar + content */}
      <div
        className={[
          styles.commentRow,
          showReplies ? styles.commentRowWithReplies : '',
          isFocused ? styles.focused : ''
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Guests have no profile (userId 0), so the avatar is only a link when
            there is somewhere for it to go. */}
        {comment.userSlug ? (
          // Hidden from assistive tech and removed from the tab order: the
          // author name beside it links to the same profile, and two adjacent
          // links to one destination is a redundant stop.
          <Link
            aria-hidden="true"
            style={{ flexShrink: 0 }}
            tabIndex={-1}
            to={userProfilePath(comment.userSlug)}
          >
            <Avatar alt={comment.user} size={avatarSize} src={comment.avatar}>
              {comment.user?.charAt(0)?.toUpperCase()}
            </Avatar>
          </Link>
        ) : (
          <Avatar alt={comment.user} size={avatarSize} src={comment.avatar} style={{ flexShrink: 0 }}>
            {comment.user?.charAt(0)?.toUpperCase()}
          </Avatar>
        )}

        <div className={styles.commentContent}>
          {isEditing ? (
            /* Edit mode: show editor with current content */
            <div className={styles.editorBreakout} data-depth={visualDepth}>
              <CommentEditor
                initialAttachments={comment.attachments}
                initialContent={comment.content}
                onCancel={handleCancelEdit}
                onSubmit={handleEdit}
                placeholder="Edit your comment..."
                submitButtonText="Save"
              />
            </div>
          ) : (
            <>
              {/* Comment bubble */}
              <div className={styles.commentBubble}>
                <div className={styles.commentMeta}>
                  {comment.userSlug ? (
                    <Link
                      className="bc-font-semibold bc-text-[14px] bc-leading-tight bc-text-inherit bc-no-underline hover:bc-underline"
                      to={userProfilePath(comment.userSlug)}
                    >
                      {comment.user}
                    </Link>
                  ) : (
                    <span className="bc-font-semibold bc-text-[14px] bc-leading-tight">
                      {comment.user}
                    </span>
                  )}
                  {/* Was a hardcoded blue "Admin" tag behind comment.isAdmin,
                      which the topic page never set — so no comment on a topic
                      carried a badge, and a moderator carried none anywhere.
                      The server now names the standing; this just prints it. */}
                  <MemberBadge badge={comment.badge} />
                  {/* Shown to everyone: a reader meeting the marker deserves to
                      know why the words are missing, and a moderator reading the
                      real content needs to know the public cannot. */}
                  {comment.hidden && (
                    <span className="bc-shrink-0 bc-rounded-full bc-bg-surface-sunken bc-px-1.5 bc-py-px bc-text-[10px] bc-font-semibold bc-leading-none bc-text-ink-muted">
                      {__('under review')}
                    </span>
                  )}
                  {/* Why this reply is sitting at the top of the thread when the
                      reader asked for oldest-first. Without it the ordering
                      looks broken rather than deliberate.

                      Shown to everyone, including readers of a forum that has
                      no pinning: `pinned` is false on every comment there, so
                      this never renders. Rendering a flag the server sent is
                      not the same as holding the feature — nothing in this
                      plugin can set it. */}
                  {comment.pinned && (
                    <span
                      // The word is dropped on a phone and the pin stands on
                      // its own — the byline row is avatar, name, badge, chip
                      // and timestamp, and that is already more than fits.
                      // `aria-label` carries what the hidden word said:
                      // `bc-hidden` takes the text from a screen reader too, so
                      // without it the icon would announce as nothing at the
                      // width where it is the only thing left.
                      aria-label={__('Pinned')}
                      className="bc-inline-flex bc-shrink-0 bc-items-center bc-gap-1 bc-rounded-full bc-bg-surface-sunken bc-px-1.5 bc-py-0.5 bc-text-[11px] bc-font-medium bc-text-ink sm:bc-px-2"
                      title={__('Singled out by the author of this topic')}
                    >
                      <LuPin size={12} />
                      <span className="bc-hidden sm:bc-inline">{__('Pinned')}</span>
                    </span>
                  )}
                  {comment.createdAt && (
                    <span
                      // #8c8c8c at 11px measured 3.10:1 — below the 4.5:1 AA
                      // floor for body text. #65676b at 12px clears it and
                      // matches the action row beneath.
                      className="bc-text-ink-muted bc-text-[12px] bc-leading-tight"
                      title={parseMaybeGmt(comment.createdAt).toLocaleString('en-US', {
                        day: 'numeric',
                        hour: 'numeric',
                        hour12: true,
                        minute: '2-digit',
                        month: 'long',
                        weekday: 'long',
                        year: 'numeric'
                      })}
                    >
                      {timeAgo(comment.createdAt)}
                    </span>
                  )}
                  <EditedNote edited={comment.edited} />
                  {/* `hidden` is true for every reader, including the ones
                      holding a tombstone — where the marker already says this in
                      words. The chip is for the two who are shown the real words
                      instead and would otherwise have no idea the forum cannot
                      see them.

                      Same chip as the topic header's, because it is the same
                      fact about a smaller thing; a warning-yellow Tag here and a
                      grey chip up there made one state look like two. */}
                  {comment.hidden && (isOwner || can('bit_connect_forum_moderate')) && (
                    <span
                      className="bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-bg-surface-sunken bc-px-2 bc-py-0.5 bc-text-[11px] bc-font-medium bc-text-ink"
                      title={__('Out of public view while a moderator reviews a report about it')}
                    >
                      <LuEyeOff size={12} />
                      {__('Hidden')}
                    </span>
                  )}
                </div>
                <div dir="auto">
                  <ContentBox
                    className="!bc-mb-0 !bc-text-[14px]"
                    content={comment.content}
                    variant="comment"
                  />
                </div>
                {/* The same treatment the topic's own files get: a screenshot
                    posted as an answer is worth as little behind a download as
                    one posted with the question. */}
                {comment.attachments && comment.attachments.length > 0 && (
                  <AttachmentList
                    attachments={comment.attachments}
                    className="bc-mt-2"
                    variant="comment"
                  />
                )}
              </div>

              {/* Actions */}
              <div className={styles.commentActions}>
                {renderVote?.(comment)}
                {/* No handler means the thread takes no replies (a locked topic). */}
                {onReply && (
                  <Button
                    className={`${styles.actionButton} ${styles.actionMeta}`}
                    icon={<MessageOutlined style={{ fontSize: '12px' }} />}
                    onClick={() => {
                      if (!isLoggedIn) {
                        openLoginWarning()
                        return
                      }
                      setShowReplyEditor(!showReplyEditor)
                    }}
                    size="small"
                    type="text"
                  >
                    {__('Reply')}
                  </Button>
                )}
                {/* Out in the row rather than in the menu beside it: a link to
                    one reply is the thing people leave a thread to send, and
                    it is offered to everyone — the menu can be empty for a
                    guest reading their own topic. */}
                <ShareButton
                  className={`${styles.actionButton} ${styles.actionMeta}`}
                  commentId={comment.id}
                  topicSlug={topicSlug}
                  topicTitle={topicTitle}
                />
                {/* Edit/Delete live in the "More" menu at every width. Inline,
                    a red Delete repeated down the whole thread outweighed Reply
                    — the action people actually come for — and put a one-click
                    destructive control under the cursor on every comment. */}
                {moreMenuItems.length > 0 && (
                  <Dropdown menu={{ items: moreMenuItems }} placement="bottomRight" trigger={['click']}>
                    <Button
                      aria-label={__('More actions')}
                      className={`${styles.actionButton} ${styles.actionMeta}`}
                      icon={<EllipsisOutlined style={{ fontSize: '16px' }} />}
                      size="small"
                      type="text"
                    />
                  </Dropdown>
                )}
              </div>

              {hasReplies && (
                <div className={styles.replyToggleRow}>
                  <Button
                    className={`${styles.replyToggle} ${styles.actionMeta}`}
                    icon={
                      repliesCollapsed ? (
                        <DownOutlined style={{ fontSize: '12px' }} />
                      ) : (
                        <UpOutlined style={{ fontSize: '12px' }} />
                      )
                    }
                    onClick={() => setRepliesCollapsed(prev => !prev)}
                    size="small"
                    type="text"
                  >
                    {repliesCollapsed
                      ? `${comment.replies.length} ${comment.replies.length === 1 ? __('reply') : __('replies')}`
                      : __('Hide')}
                  </Button>
                </div>
              )}

              {/* Reply editor */}
              <AnimatePresence initial={false}>
                {showReplyEditor && (
                  <motion.div
                    animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                    className={`${styles.editorBreakout} bc-mt-2`}
                    data-depth={visualDepth}
                    exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    initial={{ height: 0, opacity: 0 }}
                    key="reply-editor"
                    style={{ overflow: 'hidden' }}
                    transition={collapseTransition}
                  >
                    <CommentEditor
                      initialContent={replyMention}
                      onCancel={() => setShowReplyEditor(false)}
                      onSubmit={handleReply}
                      placeholder="Write a reply..."
                      // Only where the mention could not be written. With one in
                      // the box the header said the same thing twice, in the
                      // smaller of the two type sizes.
                      replyTo={replyMention ? undefined : comment.user}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Nested replies — flatten all descendants when children would reach max depth */}
      <AnimatePresence initial={false}>
        {showReplies &&
          (() => {
            const childrenAtMaxDepth = depth + 1 >= MAX_VISUAL_DEPTH
            const replies = childrenAtMaxDepth ? flattenReplies(comment.replies) : comment.replies

            return (
              <motion.ul
                animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                className={styles.replies}
                exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                initial={{ height: 0, opacity: 0 }}
                key="replies"
                style={{ overflow: 'hidden' }}
                transition={collapseTransition}
              >
                {replies.map(reply => (
                  <li className={styles.replyItem} data-parent-depth={visualDepth} key={reply.id}>
                    <CommentItem
                      comment={childrenAtMaxDepth ? { ...reply, replies: [] } : reply}
                      depth={depth + 1}
                      focusedCommentId={focusedCommentId}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onReply={onReply}
                      renderVote={renderVote}
                      replyParentId={childrenAtMaxDepth ? comment.id : undefined}
                      topicAuthorId={topicAuthorId}
                      topicSlug={topicSlug}
                      topicTitle={topicTitle}
                    />
                  </li>
                ))}
              </motion.ul>
            )
          })()}
      </AnimatePresence>
    </div>
  )
}
