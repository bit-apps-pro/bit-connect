/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `profile-badges-modal.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves and the
 * props type below stays available to `profile-badges-modal.free.tsx`, which
 * imports it.
 */
export interface ProfileBadgesModalProps {
  onClose: () => void
  open: boolean
}

export default function ProfileBadgesModal(_props: ProfileBadgesModalProps) {
  return null
}
