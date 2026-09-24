import { type ReactNode } from 'react'

import { type UserBadgesPopoverProps } from '../shared/types'

/**
 * The Badges cell in a user row: there is no cell.
 *
 * The column itself is not drawn — `useBadgesAdmin` reports no catalog and the
 * Manager table leaves the track out entirely — so nothing renders this.
 *
 * No empty column is drawn in its place either. A column that can never hold
 * anything is not a column; it is an advert with a table's chrome on.
 *
 * It still takes the cell's props so the call site stays typed against what a
 * Badges cell needs, rather than against the fact that this one draws nothing.
 */
export default function UserBadgesPopover(_props: UserBadgesPopoverProps): ReactNode {
  // eslint-disable-next-line unicorn/no-null
  return null
}
