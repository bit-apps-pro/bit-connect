/**
 * The Badges cell without the pro add-on: there is no cell.
 *
 * The column itself is not drawn in this build — `useBadgesAdmin` reports no
 * catalog and the Manager table leaves the track out entirely — so this
 * neutral answer is what the dispatch resolves to and nothing renders it. It
 * exists so the import graph resolves and so the free build never reaches the
 * assignment popover.
 *
 * No empty column is drawn in its place either. A column that can never hold
 * anything is not a column; it is an advert with a table's chrome on. What
 * profile badges are is explained once, on the Profile Badges screen, and only
 * when an admin asks for it.
 */
export default function UserBadgesPopoverFree() {
  // eslint-disable-next-line unicorn/no-null
  return null
}
