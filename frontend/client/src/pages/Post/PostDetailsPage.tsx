import { ArrowLeftOutlined } from '@ant-design/icons'
import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import ReportModal from '@features/report-modal'
import ShareDialog from '@features/share'
import { normalizeAttachments, type TopicAttachmentInfo } from '@features/topic-modal/shared/type'
import { isSameSlug } from '@utils/slug'
import { Button, Flex, Space, Tag, Typography } from 'antd'
import { useContext, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import LoginGate from '@/components/features/login-warning-modal/ui/login-gate'
import { useAdminSettingsStore } from '@/store/admin-settings.zustand'
import { useAuthStore } from '@/store/auth.zustand'
import { useSinglePostStore } from '@/store/single-post.zustand'
import { type Comment } from '@/types/post'

import Error404 from '../Error404/Error404'
import CommentEditor from './CommentEditor'
import CommentList from './CommentList'
import PostHeader from './PostHeader'
import useCommentFocus from './shared/use-comment-focus'
import AttachmentList from './ui/attachment-list'
import CommentSortSelect from './ui/comment-sort-select'
import PostDetailsSkeleton from './ui/post-details-skeleton'
import PostSidebar from './ui/PostSidebar'
import RelatedTopics from './ui/RelatedTopics'
import VoteBox from './ui/voteBox/VoteBox'

const { Title } = Typography

const countComments = (commentsList: Comment[]): number =>
  commentsList.reduce(
    (count, comment) => count + 1 + (comment.replies ? countComments(comment.replies) : 0),
    0
  )

export { relativeTime as formattedDate } from '@/utils/utils'

export default function PostDetailsPage() {
  const { postName } = useParams()
  const navigate = useNavigate()
  const { notificationApi } = useContext(NotifyContext)

  const { fetchSettings, settings } = useAdminSettingsStore()
  const {
    commentsHasMore,
    createComment,
    deleteComment,
    error,
    fetchMoreComments,
    fetchPostByName,
    isLoadingMoreComments,
    post,
    setSortOption,
    sortOption,
    toggleCommentVote,
    toggleVote,
    transformedComments,
    updateComment
  } = useSinglePostStore()
  const { isLoggedIn } = useAuthStore()
  const { open: openLoginWarning } = useLoginWarningStore()

  useEffect(() => {
    if (postName) {
      fetchPostByName(postName).catch(error_ => {
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to load post')
        })
      })
    }
  }, [postName, fetchPostByName])

  useEffect(() => {
    fetchSettings().catch(error_ =>
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to load settings')
      })
    )
  }, [fetchSettings])

  const requireLogin = (action: () => void) => {
    if (!isLoggedIn) {
      openLoginWarning()
      return false
    }
    action()
    return true
  }

  const handlePostVote = async () => {
    if (!post?.ID) return
    requireLogin(async () => {
      try {
        await toggleVote(post.ID)
      } catch (error_) {
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to vote on post')
        })
      }
    })
  }

  const handleCommentVote = async (commentId: number) => {
    requireLogin(async () => {
      try {
        await toggleCommentVote(commentId)
      } catch (error_) {
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to vote on comment')
        })
      }
    })
  }

  const handlePostComment = async (content: string, attachments?: WPAttachmentData[]) => {
    requireLogin(async () => {
      try {
        await createComment(
          content,
          undefined,
          attachments?.map(a => a.id)
        )
        notificationApi?.success({ message: __('Comment posted successfully') })
      } catch (error_) {
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to post comment')
        })
      }
    })
  }

  const handleReply = async (commentId: number, content: string, attachments?: WPAttachmentData[]) => {
    try {
      await createComment(
        content,
        commentId,
        attachments?.map(a => a.id)
      )
      notificationApi?.success({ message: __('Reply posted successfully') })
    } catch (error_) {
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to post reply')
      })
    }
  }

  const handleEditComment = async (
    commentId: number,
    content: string,
    attachments?: WPAttachmentData[]
  ) => {
    try {
      await updateComment(
        commentId,
        content,
        attachments?.map(a => a.id)
      )
      notificationApi?.success({ message: __('Comment updated successfully') })
    } catch (error_) {
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to update comment')
      })
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(commentId)
      notificationApi?.success({ message: __('Comment deleted successfully') })
    } catch (error_) {
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to delete comment')
      })
    }
  }

  const attachments: TopicAttachmentInfo[] = useMemo(
    () => normalizeAttachments(post?.attachments),
    [post?.attachments]
  )

  // The topic this page is actually showing, which is not the same question as
  // "is a topic loaded" — the store is a singleton and can still be holding the
  // previous one (see the guard below). A `#comment-N` link must not start
  // fetching threads against that. Computed here rather than after the guard
  // because the hook below it cannot be called conditionally.
  const isTopicReady = Boolean(post && isSameSlug(post.post_name, postName ?? ''))
  const focusedCommentId = useCommentFocus(isTopicReady)

  const totalCommentCount = countComments(transformedComments)
  const {
    comment: canComment,
    commentUpvote: canCommentUpvote,
    upvote: canPostUpvote
  } = settings.topicAccess

  // Back must stay inside the SPA: when the post URL was opened directly
  // (shared link, search result — the entry point SSR/SEO promotes) there is no
  // in-app history and navigate(-1) becomes a cross-document navigation — a
  // full page reload of whatever preceded the portal, or a dead end in a new
  // tab. Route to the topics list instead in that case.
  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1)
      return
    }
    navigate('/', { replace: true })
  }

  // The slug check is what keeps a previous topic from painting under the new
  // URL: the store is a singleton shared across route changes, so `post` can
  // still hold the topic we navigated away from.
  //
  // Matched decoded, never as raw strings: WordPress stores a non-ASCII slug
  // percent-encoded and the router hands the route param back decoded, so `===`
  // is false for every emoji or non-Latin title — the topic loads, the check
  // rejects it, and the page sits on the skeleton for good.
  if (!isTopicReady || !post) {
    // Only once the fetch has actually failed — without the error check this
    // flashes the 404 screen on mount, before the request has been made.
    return error ? <Error404 /> : <PostDetailsSkeleton />
  }

  const postVoteBox = (
    <VoteBox
      isVote={post.vote.hasVoted}
      onVote={canPostUpvote ? handlePostVote : undefined}
      votes={post.vote.total}
    />
  )

  return (
    // On phones the page supplies the whole gutter, because the panel below
    // drops its own padding there — see the frame note on it.
    <Flex align="start" className="bc-w-full bc-max-w-full bc-p-4 sm:bc-p-3 lg:bc-p-6" vertical>
      {/* Optically aligned with the card below by offsetting the button's own
          padding, not by removing it: zeroing padding-left lined the label up
          but left the hover surface lopsided — flush against the arrow on one
          side, 16px of empty space past the label on the other. */}
      {/* The wider margin below sm carries the gap the panel's own top padding
          used to provide there; from sm the panel takes it back. */}
      <Button
        className="bc--ml-2 bc-mb-2 bc-px-2 sm:bc-mb-1"
        icon={<ArrowLeftOutlined />}
        onClick={goBack}
        type="text"
      >
        {__('Back')}
      </Button>

      {/* Topic + rail. The rail only appears from xl (see PostSidebar); below
          that this collapses back to the single column it has always been. */}
      <div className="bc-flex bc-w-full bc-max-w-full bc-items-start bc-gap-4">
        {/* `overflow-clip`, not `hidden`: both trim wide content to the rounded
            panel, but `hidden` makes this a scrollport, and the comment
            editor's sticky toolbar would resolve against it — a box that never
            scrolls — instead of the page's scroller. */}
        {/* The frame — border, radius and padding — starts at sm. On a phone
            this panel fills the screen, so its border drew a second box just
            inside the content area's own, and the two paddings together took
            36px off each side of a 390px screen: 18% of the width spent on
            chrome the reader gains nothing from. Full-bleed below sm, with the
            page's gutter as the only inset — vertically too, or the top would
            keep an inset the sides no longer have. */}
        <Flex
          align="start"
          className="bc-min-w-0 bc-flex-1 bc-max-w-full bc-overflow-clip sm:bc-rounded-md sm:bc-border sm:bc-border-solid sm:bc-border-line sm:bc-px-3 sm:bc-py-4 lg:bc-px-4 lg:bc-py-6"
          gap="middle"
          style={{ minWidth: 0 }}
        >
          {/* One dialog for the page: the topic header and every comment row
              open it through the store with their own target. */}
          <ReportModal />
          <ShareDialog />

          <div className="bc-hidden lg:bc-block">{postVoteBox}</div>

          <Space className="bc-w-full bc-max-w-full bc-min-w-0 bc-py-1" direction="vertical">
            {/* Below lg the vote control is handed to the header, which puts it
                on the title's row; the body, byline and tags then run the full
                width of the card instead of being indented past it. */}
            {/* The topic and the files that came with it are one block, and the
                margin that closes it sits under both. Split across two Space
                items each carrying its own bottom margin, the two margins and
                the Space gap stacked into 48px above the file chips against
                24px below them — the row read as the comment section's header
                rather than as part of the topic. A comment already renders its
                files this way (see CommentItem); this is the same grouping.

                Top margin on the list rather than a bottom one on the header,
                so the block closes at the same distance from the comments
                whether or not the topic has files. */}
            <div className="bc-mb-3 lg:bc-mb-6">
              <PostHeader post={post} voteBox={postVoteBox} />

              {attachments.length > 0 && (
                <AttachmentList attachments={attachments} className="bc-mt-2 lg:bc-mt-4" />
              )}
            </div>

            {/* h2: the comments section sits directly under the topic's h1.
              Size is pinned so only the semantics change. The sort control
              shares this row — on its own it sat marooned between the editor
              and the first comment. */}
            <Flex align="center" className="bc-mb-2 lg:bc-mb-4" gap="small" justify="space-between" wrap>
              <Title className="bc-mb-0 bc-text-[18px] lg:bc-text-[20px]" level={2}>
                {__('Comments')}
                <Tag className="bc-ml-2" color="blue">
                  {totalCommentCount || Number(post.comments_count) || 0}
                </Tag>
              </Title>
              <CommentSortSelect onChange={setSortOption} value={sortOption} />
            </Flex>

            {canComment && (
              <LoginGate message={__('Log in to post a comment.')}>
                <CommentEditor onSubmit={handlePostComment} />
              </LoginGate>
            )}

            <CommentList
              comments={transformedComments}
              focusedCommentId={focusedCommentId}
              hasMore={commentsHasMore}
              isLoadingMore={isLoadingMoreComments}
              onDelete={handleDeleteComment}
              onEdit={handleEditComment}
              onLoadMore={fetchMoreComments}
              onReply={handleReply}
              onVote={canCommentUpvote ? handleCommentVote : undefined}
              sortOption={sortOption}
              topicSlug={post.post_name}
              topicTitle={post.post_title}
            />

            {/* Narrow screens have no rail, so related topics live here instead —
              the same component, sharing one request via the query cache. */}
            <RelatedTopics className="bc-mt-6 xl:bc-hidden" topic={post} />
          </Space>
        </Flex>

        <PostSidebar topic={post} />
      </div>
    </Flex>
  )
}
