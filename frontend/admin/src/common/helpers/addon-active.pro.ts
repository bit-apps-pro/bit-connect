/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * Read only by `pro-access.ts`, and only behind `isPro()`, which is a
 * compile-time `false` in this build: the `&&` there never reaches this module
 * and Rollup drops it. It exists only so the import graph resolves.
 */
export default function isAddonActive(): boolean {
  return false
}
