/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `isPro()` is a compile-time `false` in this build, so the dispatch in
 * `license-section.tsx` never renders this component and Rollup drops it from
 * the bundle. The real module — licence activation, deactivation and the
 * periodic validity check — lives with the add-on, which is distributed
 * separately, and it is deliberately absent here rather than present and
 * disabled.
 */
export default function LicenseSectionPro() {
  // eslint-disable-next-line unicorn/no-null -- the shape every .pro stub uses
  return null
}
