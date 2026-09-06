import { __ } from '@common/helpers/i18nWrap'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

import styles from './VoteBox.module.css'

interface VoteBoxProps {
  isVote?: boolean
  onVote?: () => void
  votes: number
}

export default function VoteBox({ isVote = false, onVote, votes }: VoteBoxProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    // A real button, not a div with role="button": that gave the control no
    // accessible name beyond the raw count, no pressed state, and no Space key
    // (only Enter was handled). All three come free from the element itself.
    <button
      aria-label={isVote ? __('Remove your upvote') : __('Upvote')}
      aria-pressed={isVote}
      className={`${styles.voteBox}${isVote ? ` ${styles.voted}` : ''}`}
      disabled={!onVote}
      onClick={onVote}
      type="button"
    >
      <svg
        className={styles.icon}
        height="16"
        viewBox="0 0 16 16"
        width="16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6.579 3.467c.71-1.067 2.132-1.067 2.842 0L12.975 8.8c.878 1.318.043 3.2-1.422 3.2H4.447c-1.464 0-2.3-1.882-1.422-3.2z" />
      </svg>
      {/* Keyed on the count so a vote swaps the digit with a pop — the old
          number scales out as the new one scales in. Instant feedback that the
          vote registered. */}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={styles.count}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -6 }}
          key={votes || 0}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {votes || 0}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
