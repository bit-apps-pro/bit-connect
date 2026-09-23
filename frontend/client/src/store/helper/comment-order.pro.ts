/**
 * Placeholder — the other sibling of this dispatch is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `comment-order.ts` never selects this implementation and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves.
 */
export { default } from './comment-order.free'
