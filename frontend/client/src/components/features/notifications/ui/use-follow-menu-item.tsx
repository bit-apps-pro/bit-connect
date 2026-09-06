import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { type MenuItemType } from 'antd/es/menu/interface'
import { useContext } from 'react'
import { LuBell, LuBellOff, LuLoaderCircle } from 'react-icons/lu'

import useFollowTopic, { type FollowState } from '../data/use-follow-topic'

interface FollowMenuItemOptions {
  /** The state the server sent with the topic, so the word is right on first open. */
  initial: FollowState
  isLoggedIn: boolean
  /** Called when a guest picks it — the portal shows its own sign-in prompt. */
  onRequireLogin?: () => void
  topicId: number
}

/**
 * The Follow/Unfollow entry for a topic's "More actions" menu.
 *
 * A menu entry rather than a button of its own: following is a setting, not
 * something a reader does on the way past, and the topic's action row is the
 * one place on the page competing with the title for width.
 *
 * Three states behind two verbs. Not following and muted both read as "Follow",
 * because from here they are the same offer — the hint distinguishes them,
 * because only one of the two is a decision the member made and can expect to
 * survive their next reply.
 *
 * A menu closes the moment it is picked, so unlike the button this replaced,
 * the new state is not on screen to be read: the confirmation says what
 * changed, and it is the only thing that does.
 */
export default function useFollowMenuItem({
  initial,
  isLoggedIn,
  onRequireLogin,
  topicId
}: FollowMenuItemOptions): MenuItemType {
  const { notificationApi } = useContext(NotifyContext)
  const { followState, isTogglingFollow, toggleFollow } = useFollowTopic(topicId, initial)

  const { following, muted, source } = followState

  const handleClick = () => {
    if (!isLoggedIn) {
      onRequireLogin?.()

      return
    }

    const follow = !following

    toggleFollow(follow).then(
      () => {
        notificationApi?.success({
          message: follow
            ? __('You will be notified about new replies.')
            : __('You will no longer be notified about this topic.')
        })
      },
      () => {
        // The hook has already put the setting back, but nothing on screen was
        // showing it — the menu closed on the click. Saying so is the only way
        // the member learns the thread is still going to mail them.
        notificationApi?.error({ message: __('Could not change your follow setting.') })
      }
    )
  }

  // Four sentences for three states, because "you are following this because you
  // replied" and "you chose to follow this" are different things to be told when
  // deciding whether to stop.
  const hint = (() => {
    if (following && source === 'auto') {
      return __('You are following this because you took part.')
    }
    if (following) return __('You chose to follow this topic.')
    if (muted) return __('You muted this topic.')

    return __('Notify me when someone replies.')
  })()

  const icon = (() => {
    if (isTogglingFollow) return <LuLoaderCircle className="bc-animate-spin" />

    return following ? <LuBellOff /> : <LuBell />
  })()

  return {
    disabled: isTogglingFollow,
    icon,
    key: 'follow',
    // The verb carries the state: out in the row a filled bell said "on" at a
    // glance, and inside a menu there is no glance to say it to. "Unfollow"
    // only makes sense to someone who is following, so reading it is being
    // told.
    label: following ? __('Unfollow') : __('Follow'),
    onClick: handleClick,
    title: hint
  }
}
