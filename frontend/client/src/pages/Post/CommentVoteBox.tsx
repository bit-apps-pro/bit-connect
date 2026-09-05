import { __ } from '@common/helpers/i18nWrap'
import { motion, useReducedMotion } from 'framer-motion'

interface VoteBoxProps {
  isVote?: boolean
  onVote?: () => void
  votes: number
}

const baseClasses =
  'bc-text-[12px] bc-h-6 bc-flex bc-flex-row bc-items-center bc-justify-center bc-gap-1 bc-rounded-[4px] ' +
  'bc-border-0 bc-bg-transparent bc-shadow-none bc-cursor-pointer bc-outline-none bc-px-2 ' +
  'bc-transition-colors bc-duration-200 hover:bc-bg-[rgba(0,0,0,0.06)]'

export default function CommentVoteBox({ isVote = false, onVote, votes }: VoteBoxProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    // See VoteBox: a native button carries the name, the pressed state and the
    // Space key that a div with role="button" has to reimplement, and did not.
    <motion.button
      aria-label={isVote ? __('Remove your upvote') : __('Upvote')}
      aria-pressed={isVote}
      className={`${baseClasses} ${isVote ? 'bc-text-primary' : 'bc-text-ink-muted hover:bc-text-ink'}`}
      disabled={!onVote}
      onClick={onVote}
      type="button"
      whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
    >
      <motion.svg
        animate={isVote && !shouldReduceMotion ? { scale: [1, 1.4, 1] } : { scale: 1 }}
        className={`bc-stroke-current ${isVote ? 'bc-fill-current' : 'bc-fill-none'}`}
        height="12"
        initial={false}
        strokeWidth="1.5"
        transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
        viewBox="0 0 16 16"
        width="12"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6.579 3.467c.71-1.067 2.132-1.067 2.842 0L12.975 8.8c.878 1.318.043 3.2-1.422 3.2H4.447c-1.464 0-2.3-1.882-1.422-3.2z" />
      </motion.svg>
      <motion.span
        animate={{ opacity: 1, y: 0 }}
        className="bc-font-semibold"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
        key={votes}
      >
        {votes || 0}
      </motion.span>
      <span className="bc-hidden sm:bc-inline">{__('Upvote')}</span>
    </motion.button>
  )
}
