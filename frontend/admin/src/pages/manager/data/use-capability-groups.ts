export interface CapabilityGroup {
  caps: string[]
  label: string
  /**
   * What to call each of this group's capabilities.
   *
   * Optional, and only a group whose capabilities this plugin does not declare
   * needs it: the server sends a translated label for every capability it
   * recognises, and a slug it has never heard of is not in that map.
   */
  labels?: Record<string, string>
}

/**
 * No extra rows.
 *
 * A module-level constant rather than a new array each render, so the matrix
 * does not rebuild itself on every keystroke in the modal above it.
 */
const NONE: CapabilityGroup[] = []

/**
 * Extra rows for the role capabilities matrix.
 *
 * The matrix is built from this plugin's own groups plus whatever this returns,
 * which here is nothing: a capability this forum does not recognise has no row,
 * rather than a row that grants something nothing reads. The server agrees —
 * the roles screen is saved against ExtensionPoints::capabilities(), and a slug
 * not named there is not stored.
 */
export default function useCapabilityGroups(): CapabilityGroup[] {
  return NONE
}
