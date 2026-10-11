import { __ } from '@common/helpers/i18nWrap'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'

import styles from './VoteBox.module.css'

interface VoteBoxProps {
  /** A square with the count alone, for a row it shares with a heading. */
  compact?: boolean
  isVote?: boolean
  onVote?: () => void
  votes: number
}

export default function VoteBox({ compact = false, isVote = false, onVote, votes }: VoteBoxProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    // A real button, not a div with role="button": that gave the control no
    // accessible name beyond the raw count, no pressed state, and no Space key
    // (only Enter was handled). All three come free from the element itself.
    <button
      aria-label={isVote ? __('Remove your upvote') : __('Upvote')}
      aria-pressed={isVote}
      className={[styles.voteBox, isVote && styles.voted, compact && styles.compact]
        .filter(Boolean)
        .join(' ')}
      disabled={!onVote}
      onClick={onVote}
      title={onVote ? undefined : __('Voting is not available to you')}
      type="button"
    >
      <svg
        className={styles.icon}
        height="16"
        viewBox="0 0 16 16"
        width="16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M8 4.5 14.5 12h-13z" />
      </svg>
      {/* Keyed on the count so a vote swaps the digit with a pop — the old
          number scales out as the new one scales in. Instant feedback that the
          vote registered. */}
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={styles.count}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 6 }}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -6 }}
          key={votes || 0}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {votes || 0}
        </m.span>
      </AnimatePresence>
      {/* Hidden from assistive tech: the button is already named "Upvote", and
          the word only labels the number for a sighted reader. */}
      {!compact && (
        <span aria-hidden="true" className={styles.label}>
          {__('Votes')}
        </span>
      )}
    </button>
  )
}
