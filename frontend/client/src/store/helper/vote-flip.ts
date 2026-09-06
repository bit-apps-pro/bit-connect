/** The vote state a topic or a comment carries. */
export interface Vote {
  hasVoted: boolean
  total: number
}

/**
 * What a vote button should show the instant it is pressed.
 *
 * The server is the authority on the total, but waiting for it to answer put a
 * round trip between the click and the count moving — on a real deployment that
 * reads as a button that does nothing, and the reader clicks again. The outcome
 * of a toggle is known without asking: their own vote goes on or comes off, so
 * the count moves by one. The confirmed total replaces this a moment later, and
 * a failed request puts back what was there before.
 */
export const flipVote = <T extends Vote>(vote: T): T => ({
  ...vote,
  hasVoted: !vote.hasVoted,
  // Only reachable if the cached total was already behind, but a vote button
  // reading "-1" would be worse than one reading "0".
  total: Math.max(0, vote.total + (vote.hasVoted ? -1 : 1))
})
