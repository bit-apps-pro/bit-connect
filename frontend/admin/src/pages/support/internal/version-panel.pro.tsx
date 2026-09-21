import { type VersionPanelProps } from '../shared/types'

/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `isPro()` is a compile-time `false` in this build, so the dispatch in
 * `version-panel.tsx` never renders this component and Rollup drops it from the
 * bundle. The module exists only so the import graph resolves.
 */
export default function VersionPanelPro(_props: VersionPanelProps) {
  return null
}
