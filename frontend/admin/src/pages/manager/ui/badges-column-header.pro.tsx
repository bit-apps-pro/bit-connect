/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `badges-column-header.tsx` never renders this component and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves.
 */
export default function BadgesColumnHeaderPro() {
  return null
}
