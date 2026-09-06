import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { RESTING_FOLLOW_STATE, useFollowMenuItem } from '@features/notifications'
import { useReportModalStore } from '@features/report-modal'
import { ShareButton } from '@features/share'
import { type Topic } from '@features/topic-modal/shared/type'
import useTopicModalStore from '@features/topic-modal/state/use-topic-modal-store'
import EditIcon from '@icons/EditIcon'
import { pickThemedIcon } from '@shared/theme/themed-icon'
import EditedNote from '@utilities/edited-note'
import UserLink from '@utilities/user-link'
import { Button, Dropdown, Flex, type MenuProps, Modal, Select, Space, Tag, Typography } from 'antd'
import { useAtomValue } from 'jotai'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { LuClock, LuEllipsisVertical, LuEyeOff, LuFlag, LuTrash } from 'react-icons/lu'
import { useNavigate } from 'react-router'

import { $isDarkTheme } from '@/common/globalStates/$appConfig'
import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import { useAuthStore } from '@/store/auth.zustand'
import { useSinglePostStore } from '@/store/single-post.zustand'
import { useStagesStore } from '@/store/stages.zustand'
import { useStatusesStore } from '@/store/statuses.zustand'
import { toEditAttribution } from '@/types/edit-attribution'
import useChipProps from '@/utils/use-chip-props'

import ContentBox from './ContentBox'
import { formattedDate } from './PostDetailsPage'
import TagChips from './ui/tag-chips'

export default function PostHeader({
  post,
  voteBox
}: {
  post: Topic
  /** Rendered on the title's row below lg only; from lg the page puts it in a
   *  column of its own beside the whole topic. */
  voteBox?: React.ReactNode
}) {
  const {
    terms: { statuses, topic_types: topicTypes }
  } = post
  const postDate = formattedDate(post.post_date_gmt)
  const { chipTagProps } = useChipProps()
  const { notificationApi } = useContext(NotifyContext)
  const { can, user } = useAuthStore()
  const isDarkTheme = useAtomValue($isDarkTheme)
  const {
    fetchStatuses,
    isLoading,
    isUpdatingStatus,
    statuses: allStatuses,
    updatePostStatus
  } = useStatusesStore()
  const { deletePost, isDeleting, setPost } = useSinglePostStore()
  const {
    fetchStages,
    isLoading: isStageLoading,
    isUpdatingStage,
    stages,
    updatePostStage
  } = useStagesStore()
  const { openEditModal } = useTopicModalStore()
  const { open: openReport } = useReportModalStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const navigate = useNavigate()

  // These are capabilities, not roles: Manager can grant any of them to any
  // role and take them away from an administrator, so asking for the cap is the
  // only reading that matches what TopicController will accept.
  //
  // Running the queue and moving a status is forum_moderate; removing a topic
  // is forum_delete_any. There is no third power here: rewording somebody
  // else's topic is not something this forum grants to anyone.
  const canModerate = can('forum_moderate')
  const canDeleteAny = can('forum_delete_any')
  const isOwner = user?.id && post.post_author && user.id === Number(post.post_author)
  // Mirrors TopicController::update() — the author, at any status. The status
  // no longer narrows this: it used to close the author's window once a
  // moderator moved the topic on, which only made sense while a moderator could
  // still correct it afterwards.
  const canEditPost = Boolean(isOwner && can('forum_edit_own_post'))
  const canDeletePost = canDeleteAny || Boolean(isOwner && can('forum_delete_own_post'))

  useEffect(() => {
    if (allStatuses.length === 0) {
      fetchStatuses().catch(() => {
        notificationApi?.error({ message: __('Failed to load statuses') })
      })
    }

    if (stages.length === 0) {
      fetchStages().catch(() => {
        notificationApi?.error({ message: __('Failed to load stages') })
      })
    }
  }, [allStatuses.length, fetchStatuses, fetchStages, stages.length])

  // Visitors read the status from a colour-coded tag; moderators used to get the
  // same information as plain text in a grey dropdown, so the one group that
  // acts on status had the weakest signal of what it currently is. The colour
  // and icon are already on the term — they were simply never rendered here.
  const statusOptions = useMemo(
    () =>
      allStatuses.map(status => ({
        label: (
          <span className="bc-flex bc-items-center bc-gap-2">
            <span
              aria-hidden
              className="bc-h-2 bc-w-2 bc-shrink-0 bc-rounded-full"
              style={{ backgroundColor: status.meta?.color || '#d9d9d9' }}
            />
            {status.name}
          </span>
        ),
        value: status.id
      })),
    [allStatuses]
  )

  const stageOptions = useMemo(
    () =>
      stages.map(stage => {
        const icon = pickThemedIcon(stage.meta, isDarkTheme)

        return {
          label: (
            <span className="bc-flex bc-items-center bc-gap-2">
              {icon && (
                <img alt="" className="bc-h-3.5 bc-w-3.5 bc-shrink-0 bc-object-contain" src={icon} />
              )}
              {stage.name}
            </span>
          ),
          value: stage.id
        }
      }),
    [stages, isDarkTheme]
  )

  const handleStatusChange = async (termId: number) => {
    try {
      const updatedTopic = await updatePostStatus(post.ID, termId)
      setPost(updatedTopic)
      notificationApi?.success({ message: __('Status updated successfully') })
    } catch (error_) {
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to update status')
      })
    }
  }

  const handleStageChange = async (termId: number) => {
    try {
      const updatedTopic = await updatePostStage(post.ID, termId)
      setPost(updatedTopic)
      notificationApi?.success({ message: __('Stage updated successfully') })
    } catch (error_) {
      notificationApi?.error({
        message: (error_ as { message?: string })?.message ?? __('Failed to update stage')
      })
    }
  }

  const handleDelete = useCallback(() => {
    Modal.confirm({
      cancelText: __('Cancel'),
      content: __('This action cannot be undone. Are you sure you want to delete this post?'),
      okButtonProps: { danger: true, loading: isDeleting },
      okText: __('Delete'),
      onOk: async () => {
        try {
          await deletePost(post.ID)
          notificationApi?.success({ message: __('Post deleted successfully') })
          navigate('/', { replace: true })
        } catch (error_) {
          notificationApi?.error({
            message: (error_ as { message?: string })?.message ?? __('Failed to delete post')
          })
        }
      },
      title: __('Delete Post'),
      type: 'warning'
    })
  }, [deletePost, isDeleting, navigate, post.ID])

  const handleEdit = useCallback(() => {
    openEditModal(post.ID)
  }, [openEditModal, post.ID])

  const handleReport = useCallback(() => {
    if (!user?.id) {
      openLoginWarning()

      return
    }

    openReport({ excerpt: post.post_content, id: post.ID, type: 'post' })
  }, [openLoginWarning, openReport, post.ID, post.post_content, user?.id])

  // Follow lives in this menu rather than out in the action row: it is a
  // setting on the thread, not a step in reading it, and the row it used to
  // sit in is the one competing with the title for width. Its own hook, so the
  // three states and the wording for each stay inside the notifications
  // feature and this file only places the entry.
  const followItem = useFollowMenuItem({
    initial: post.following ?? RESTING_FOLLOW_STATE,
    isLoggedIn: Boolean(user?.id),
    onRequireLogin: openLoginWarning,
    topicId: post.ID
  })

  // Everything here acts on the topic itself, and every entry is gated on a
  // capability — which is why the group can come out empty, and why Follow is
  // added separately below rather than being pushed onto the same list.
  const topicItems = useMemo(() => {
    const items: {
      danger?: boolean
      icon: React.ReactNode
      key: string
      label: string
      onClick: () => void
    }[] = []

    if (canEditPost) {
      items.push({
        icon: <EditIcon />,
        key: '1',
        label: __('Edit'),
        onClick: handleEdit
      })
    }

    if (canDeletePost) {
      items.push({
        danger: true,
        icon: <LuTrash />,
        key: '2',
        label: __('Delete'),
        onClick: handleDelete
      })
    }

    // Not offered on your own topic — the server refuses it, and the author
    // already has Edit and Delete here.
    if (!isOwner) {
      items.push({
        icon: <LuFlag />,
        key: '3',
        label: __('Report'),
        onClick: handleReport
      })
    }

    return items
  }, [canDeletePost, canEditPost, handleDelete, handleEdit, handleReport, isOwner])

  // A rule between the two groups: "stop mailing me about this" and "delete
  // this" are not neighbours, and the gap is what stops a hand aiming for the
  // first from landing on the second. No rule when there is nothing to
  // separate — a guest's menu is Follow and nothing else.
  //
  // Not memoised: `followItem` carries live follow state and is a new object
  // every render, so a memo here would only be a dependency list that never
  // matches.
  const moreMenu: MenuProps =
    topicItems.length > 0
      ? { items: [followItem, { type: 'divider' }, ...topicItems] }
      : { items: [followItem] }

  // Read-only status chip, shown to everyone who cannot change the status.
  const statusTag = statuses && (
    <Tag className="bc-m-0" {...chipTagProps(statuses.meta.color)}>
      {statuses.name}
    </Tag>
  )

  // Status (and stage, for admins) controls. On their own row under the title
  // at every width — the phone layout, adopted everywhere. Inline beside the
  // title they were two controls competing with the heading for the same line,
  // and the heading lost: a title of any length wrapped early to leave them
  // room. Under it they have the full width and cost the title nothing.
  const statusControls = (
    <Space size="small" wrap>
      {canModerate && (
        <Select
          aria-label={__('Topic stage')}
          disabled={isUpdatingStage}
          loading={isStageLoading}
          onChange={handleStageChange}
          options={stageOptions}
          size="small"
          title={__('Topic stage')}
          value={post.terms.stages?.term_id}
          variant="filled"
        />
      )}
      {canModerate ? (
        <Select
          aria-label={__('Topic status')}
          disabled={isUpdatingStatus}
          loading={isLoading}
          onChange={handleStatusChange}
          options={statusOptions}
          size="small"
          title={__('Topic status')}
          value={post.terms.statuses?.term_id}
          variant="filled"
        />
      ) : (
        statusTag
      )}
    </Space>
  )

  return (
    // No bottom margin of its own. The page groups this with the topic's
    // attachments and carries the separation under the pair — the files arrived
    // with the topic and belong to it, and a margin here stacked with the
    // byline's and the list's own to leave them 48px below the topic and 24px
    // above the comments, reading as the comment section's header.
    <div className="bc-max-w-full bc-overflow-hidden">
      <Flex align="start" gap="large">
        <div className="bc-flex-1 bc-min-w-0 bc-max-w-full">
          {/* Bottom margin on the row, not on the title: below lg the row's
              height is the vote control's, so a margin on the title alone
              disappeared under it and the body started flush against it. */}
          {/* Spacing as margins on the two flanking items rather than a `gap` on
              the row: a gap is symmetric, and the space it put to the left of
              the actions was space the title lost for nothing — the icon button
              carries 12px of padding of its own, which is the whole separation
              it needs. */}
          {/* No wrap and no basis floor on the title. Both existed to protect
              the heading from the controls that used to share this line: they
              did not shrink, so on a 1024px window the status selects, Follow,
              Share and the menu took ~395px of a ~514px row and left the h1
              103px — a 26px heading breaking after two characters. The floor
              bought the heading a line of its own at the cost of stranding the
              controls on the next one. With the status controls moved below,
              the only thing beside the title is one 32px icon button, which can
              never squeeze it: `flex-1 min-w-0` simply hands the heading
              whatever the button leaves, at every width, and the button keeps
              the title's line instead of dropping under it on a phone. */}
          <Flex align="flex-start" className="bc-mb-3">
            {/* Below lg the vote control belongs to this row rather than to a
                column beside the whole header: as a column it indented the
                body, the byline and the tags by its width for the length of the
                topic, taking ~52px off a measure that on a phone has none to
                spare. It only needs to sit next to what it counts. From lg the
                page is wide enough for the column and renders it there. */}
            {voteBox && <div className="bc-mr-3 sm:bc-mr-4 lg:bc-hidden">{voteBox}</div>}

            {/* The topic title is the page's one h1 — it names the document for
                assistive tech and for the SEO markup rendered server-side. The
                explicit size keeps the previous h4 appearance. */}
            <Typography.Title
              className="bc-mb-0 bc-min-w-0 bc-flex-1 bc-text-[20px] bc-font-semibold bc-leading-snug lg:bc-text-[26px]"
              level={1}
            >
              {post.post_title}
            </Typography.Title>
            {/* No negative margin to hang the glyph over the edge, the way the
                Back button does: that button sits outside the topic panel,
                while this one is inside it, and the panel clips its overflow —
                the pulled button kept its hit area but had the right half of
                its hover surface sliced off. It stays within the panel and lets
                its own padding be the inset.

                The only thing on the title's right at any width: the status and
                stage controls moved to the row below, so this glyph keeps the
                same corner on a phone and on a desktop and a reader who learns
                where it is on one keeps that knowledge on the other.

                `shrink-0` so the button is never squeezed narrower than its hit
                area, whatever the heading beside it is doing.

                Sharing is no longer a glyph on this row — a single icon here
                asked the reader to open a dialog before they could see whether
                the forum could reach the place they had in mind; the
                destinations themselves now sit in the rail from xl and under
                the byline below it.

                Always rendered now that Follow is inside it — there is no
                reader, not even a signed-out one, for whom this menu is
                empty. */}
            <Dropdown menu={moreMenu}>
              <Button
                aria-label={__('More actions')}
                className="bc-ms-auto bc-shrink-0"
                icon={<LuEllipsisVertical />}
                type="text"
              />
            </Dropdown>
          </Flex>

          {/* What the topic *is* — its status, and below lg its type — reads
              directly under its name, before the body.

              These labels answer the question a reader arrives with (is this
              fixed? is it a bug or a discussion?), and they were answering it
              from underneath the body, in the byline, where a reader who had
              already read the whole topic found them last. The byline is for
              who wrote it and when; this row is for what it is.

              One row whether or not the reader can act on it: a moderator gets
              the two selects where everyone else gets the chip, so the control
              sits exactly where the label it replaces was — and now at the same
              place on every screen, rather than jumping up beside the title
              from lg. The type chip is only here below lg: from lg it has the
              byline, and from xl the rail lists it.

              `lg:hidden` when there is no status to show, so a topic that only
              has a type is not left with an empty row from lg up, where the
              chip inside it is hidden. */}
          {(canModerate || statusTag || topicTypes) && (
            <div
              className={`bc-mb-3 bc-mt-1 bc-flex bc-flex-wrap bc-items-center bc-gap-2 ${
                canModerate || statuses ? '' : 'lg:bc-hidden'
              }`}
            >
              {canModerate ? statusControls : statusTag}
              {topicTypes && (
                <Tag className="bc-m-0 lg:bc-hidden" {...chipTagProps(topicTypes.meta.color)}>
                  {topicTypes.name}
                </Tag>
              )}
            </div>
          )}

          {/* Measure capped at ~72 characters. Full-width, the body ran ~145
              characters per line on a desktop card — twice the span the eye can
              track back to the start of the next line. */}
          <ContentBox className="bc-max-w-[54ch]" content={post.post_content} />

          {/* <Paragraph className="bc-mb-4 bc-text-[15px] bc-leading-[1.6]">{post.description}</Paragraph> */}

          {/* Tags follow the author meta inline rather than being pushed to the
              card's right edge: with the body capped to a readable measure, a
              right-aligned tag group sat alone in ~300px of empty space. */}
          <Flex align="start" gap="middle" wrap>
            {/* A flex row rather than an antd Space: Space wraps every child in
                an `.ant-space-item`, which stays a flex item — and keeps its
                share of the gap — even when the child inside it is hidden. */}
            {/* No bottom margin: this is itself a flex item of the wrapping row
                above, so the margin was added to that row's gap rather than
                replacing it — 32px between the byline and its own tags in the
                band where they wrap onto a line of their own. The row's gap is
                the only spacing between the items inside it, and what closes
                the block is the margin the page puts under the whole group. */}
            <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-x-4 bc-gap-y-2">
              <UserLink
                avatar={post.author_avatar}
                avatarSize={24}
                badge={post.author_badge}
                name={post.author_name}
                nameClassName="bc-whitespace-nowrap"
                slug={post.author_slug}
              />
              <Flex align="center" className="bc-text-sm bc-text-ink-muted" gap={'small'}>
                {/* Decoration beside a self-explanatory "2mo ago", and on a
                    phone its 28px was the difference between the byline holding
                    one line and the chips after it wrapping onto a third. Same
                    call the topic card makes at the same width. */}
                <LuClock className="bc-hidden sm:bc-block" size={20} />
                <span className="bc-whitespace-nowrap">{postDate}</span>
              </Flex>

              {/* Below xl only — from xl the rail carries the destinations
                  themselves, in a card under the author, and a button here
                  would be the same offer made twice.

                  One button rather than the row of brand marks: without a rail
                  the row has to share the byline's line, where five 34px hit
                  areas set the height of a line of 14px text and the
                  attribution reads as a toolbar. The button carries the same
                  networks one tap away, in the dialog. */}
              <ShareButton
                className="bc--mx-2 bc-text-ink-muted xl:bc-hidden"
                topicSlug={post.post_name}
                topicTitle={post.post_title}
              />

              {/* Beside the date rather than under the title: a reader checking
                  how old a topic is has the same reason to know whether these
                  are still only the author's words. */}
              <EditedNote edited={toEditAttribution(post.edited)} />

              {/* Only in the lg–xl band. Below lg the type chip belongs to the
                  row under the title, with the status; from xl the rail lists
                  it. In between it rides the byline rather than the status row,
                  which at that width is the moderator's two selects — a chip
                  wedged against a pair of controls reads as a third one. */}
              {topicTypes && (
                <Tag
                  className="bc-m-0 bc-hidden lg:bc-inline-block xl:bc-hidden"
                  {...chipTagProps(topicTypes.meta.color)}
                >
                  {topicTypes.name}
                </Tag>
              )}
              {/* No attachment count here: the download chips render directly
                  below this row and already name every file. */}
            </div>

            {/* Only the author and a moderator are ever served a hidden topic,
                so this is the one place either of them can be told why nobody
                else can find it — without it the author watched their topic
                disappear from the portal, from their own profile and from its
                own URL, with nothing saying it had been reported rather than
                deleted.

                Under the byline and at the byline's own size, because it belongs
                to the same set of facts as the date and the edited note: who can
                see this, and since when. A banner above the title said it three
                times louder and read as an accusation levelled at the author
                over a report somebody else filed.

                On its own row rather than inside the Space above: sharing that
                row, it was allotted a fraction of the width and wrapped a single
                sentence over three lines.

                A chip carries the state and the sentence carries the
                consequence. One long bolded sentence said both at once and read
                as a wall; the chip is scannable at byline size, and the
                explanation earns its place by answering the only question the
                author actually has — is my post gone?

                One text flow rather than a flex row: as flex items the sentence
                claimed the full width and shouldered the chip onto a line of its
                own, leaving a label stranded above a paragraph. Inline, the chip
                simply starts the sentence. */}
            {post.hidden && (
              <div className="bc-max-w-[54ch] bc-text-sm bc-leading-relaxed bc-text-ink-muted">
                <span className="bc-mr-1.5 bc-inline-flex bc-items-center bc-gap-1 bc-rounded-full bc-bg-surface-sunken bc-px-2 bc-py-0.5 bc-align-[-2px] bc-text-xs bc-font-medium bc-text-ink">
                  <LuEyeOff size={13} />
                  {__('Hidden')}
                </span>
                {isOwner
                  ? __(
                      'Only you and the moderators can see this while a report is reviewed. Nothing has been deleted.'
                    )
                  : __('Out of public view while a report is reviewed.')}
              </div>
            )}

            {/* From xl the rail carries the tag list; below xl there is no rail,
                so it lives here — and now as the same component, so the two
                cannot drift. They were loose secondary text here and clickable
                pills there: identical tags, but the one width where a reader
                could not follow one was the phone, which is the only width with
                no rail to follow it in.

                Above the byline on phones, below it from sm. That is not two
                minds about the order: from sm the tags fit on the byline's own
                line, where the author leads and the tags trail as one row. On a
                phone they never fit, so they take a line of their own — and a
                line of its own is a position to choose rather than a leftover.
                They describe the topic, like the chips under its title, so they
                belong to it rather than trailing the attribution that closes
                the block. */}
            <TagChips
              className="bc-order-first bc-basis-full sm:bc-order-none sm:bc-basis-auto xl:bc-hidden"
              topic={post}
            />
          </Flex>
        </div>
      </Flex>
    </div>
  )
}
