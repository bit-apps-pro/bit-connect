import { __ } from '@common/helpers/i18nWrap'
import { type Topic } from '@features/topic-modal/shared/type'
import { type ReactNode } from 'react'
import { LuEyeOff } from 'react-icons/lu'

/** The chip's look, shared with whatever explains the state another way. */
export const TOPIC_CARD_STATE_CHIP =
  'bc-inline-flex bc-shrink-0 bc-items-center bc-gap-1 bc-whitespace-nowrap bc-rounded-full bc-bg-surface-sunken bc-px-2 bc-py-0.5 bc-text-xs bc-font-medium bc-text-ink'

/**
 * Marks a card whose topic is out of public view.
 *
 * Only its author and the moderators are ever served such a topic in a list,
 * and both need to tell it apart from the rest at a glance: the author, that
 * nobody else can see it yet; a moderator, that it is waiting on them. The
 * topic page says why.
 */
export default function TopicCardState({ topic }: { topic: Topic }): ReactNode {
  if (!topic.hidden) return

  return (
    <span className={TOPIC_CARD_STATE_CHIP}>
      <LuEyeOff size={13} />
      {__('Hidden')}
    </span>
  )
}
