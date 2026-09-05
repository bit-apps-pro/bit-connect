/**
 * Placeholder — the Bit Connect Pro add-on is not part of this repository.
 *
 * `IS_PRO_ACTIVE` is a compile-time `false` in this build, so the dispatch in
 * `use-badges-admin.ts` never selects this implementation and Rollup drops it
 * from the bundle. The module exists only so the import graph resolves.
 *
 * Without the add-on there is no catalog to fetch and no assignment to save, so
 * the free implementation already describes the behaviour exactly.
 */
export { default } from './use-badges-admin.free'
