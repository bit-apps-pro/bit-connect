import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import useLoginWarningStore from '@features/login-warning-modal/state/use-login-warning-store'
import { Button } from 'antd'
import { useContext } from 'react'
import { LuBell, LuBellRing } from 'react-icons/lu'

import { useAuthStore } from '@/store/auth.zustand'

import useFollowState from '../data/use-follow-state'
import { type FollowState, useFollowTarget } from '../data/use-follow-topic'

interface FollowButtonProps {
  className?: string
  /** What the thing is called — "Tag" — so the button can say "Follow tag". */
  kind: string
  /** Its name — "onboarding" — for the confirmation. */
  subject: string
  targetId: number
  /** `tag`, or a type the server adds — see FollowService::isValidTargetType. */
  targetType: string
}

/** "Follow tag". */
const followLabel = (kind: string) =>
  // translators: %s: what is being followed — "tag", "department".
  sprintf(__('Follow %s'), kind.toLowerCase())

/**
 * Follow or unfollow something that is not a topic — a tag's archive, say.
 *
 * A button rather than a menu entry, unlike a topic's: an archive has no
 * action row for Follow to compete with, and following a tag is the reason a
 * reader comes to its page rather than something they do on the way past.
 *
 * It names what it follows ("Follow tag"), because a bare "Follow" on a page
 * that lists topics read as following the topics — and "Following" once it
 * is, in the filled style, so the state is visible without reading the verb.
 * The hover text and the confirmation say what following gets you: new
 * topics under this term, in your notifications.
 *
 * Rendered once the member's state is known. The hook keeps the state it was
 * given, so handing it a guess and the answer later would leave the button
 * showing the guess.
 */
export default function FollowButton(props: FollowButtonProps) {
  const { isLoggedIn } = useAuthStore()
  const { followState, isLoadingFollowState } = useFollowState(props.targetType, props.targetId, isLoggedIn)

  if (isLoadingFollowState || !followState) {
    return (
      <Button className={props.className} disabled icon={<LuBell />}>
        {followLabel(props.kind)}
      </Button>
    )
  }

  return <FollowControl {...props} initial={followState} isLoggedIn={isLoggedIn} />
}

function FollowControl({
  className,
  initial,
  isLoggedIn,
  kind,
  subject,
  targetId,
  targetType
}: FollowButtonProps & { initial: FollowState; isLoggedIn: boolean }) {
  const { notificationApi } = useContext(NotifyContext)
  const { open: openLoginWarning } = useLoginWarningStore()
  const { followState, isTogglingFollow, toggleFollow } = useFollowTarget(targetType, targetId, initial)
  const { following } = followState

  const handleClick = () => {
    if (!isLoggedIn) {
      openLoginWarning()

      return
    }

    const follow = !following

    toggleFollow(follow).then(
      () => {
        notificationApi?.success({
          description: follow
            ? // translators: %s: the tag's name.
              sprintf(__('New topics under “%s” will appear in your notifications.'), subject)
            : // translators: %s: the tag's name.
              sprintf(__('New topics under “%s” will no longer notify you.'), subject),
          message: follow ? sprintf(__('Following “%s”'), subject) : sprintf(__('Unfollowed “%s”'), subject)
        })
      },
      () => {
        // The hook has already put the button back; saying so is what tells
        // the member the click did nothing.
        notificationApi?.error({ message: __('Could not change your follow setting.') })
      }
    )
  }

  return (
    <Button
      aria-pressed={following}
      className={className}
      icon={following ? <LuBellRing /> : <LuBell />}
      loading={isTogglingFollow}
      onClick={handleClick}
      title={
        following
          ? // translators: %s: what is being followed — "tag", "department".
            sprintf(__('You get notified about new topics here. Click to stop following this %s.'), kind.toLowerCase())
          : __('Get notified when a new topic is posted here.')
      }
      type={following ? 'primary' : 'default'}
    >
      {following ? __('Following') : followLabel(kind)}
    </Button>
  )
}
