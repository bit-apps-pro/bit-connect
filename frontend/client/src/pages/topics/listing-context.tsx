import { CHIP_CLASS } from './choice-chip'

/**
 * Where the list is, at the head of the filter row: the term a tag, type or
 * status archive is listing, named below lg — from there the archive's own
 * heading names it.
 *
 * @param archiveName the term the archive is listing; nothing renders without one.
 */
export default function ListingContext({ archiveName = '' }: { archiveName?: string }) {
  if (!archiveName) return null

  return (
    <div className="bc-flex lg:bc-hidden">
      <span className={CHIP_CLASS}>
        <span className="bc-min-w-0 bc-truncate">{archiveName}</span>
      </span>
    </div>
  )
}
