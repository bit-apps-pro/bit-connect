/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `topic-access-extras.tsx` never selects this implementation and Rollup drops
 * it from the bundle. The module exists only so the import graph resolves.
 */
export { default } from './topic-access-extras.free'
