/**
 * The badge catalog editor without the add-on: there is no editor.
 *
 * Nothing opens it in this build — the Manager header draws the Profile Badges
 * button only where `useBadgesAdmin` reports a catalog, and here it never does
 * — so this neutral answer is what the dispatch resolves to and nothing
 * renders it. It exists so the import graph resolves and so the free build
 * never reaches the real editor or the endpoints it calls.
 *
 * No explanatory modal is drawn in its place either. A screen that describes
 * a feature this plugin does not have, reached from a button shaped like the
 * feature, is a placeholder for it; what the add-on adds is said in words on
 * the Support screen instead.
 */
export default function ProfileBadgesModalFree() {
  // eslint-disable-next-line unicorn/no-null
  return null
}
