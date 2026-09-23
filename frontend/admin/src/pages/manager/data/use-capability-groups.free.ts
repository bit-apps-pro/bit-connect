import { type CapabilityGroup } from './use-capability-groups'

/**
 * No extra rows without the add-on.
 *
 * A module-level constant rather than a new array each render, so the matrix
 * does not rebuild itself on every keystroke in the modal above it.
 */
const NONE: CapabilityGroup[] = []

export default function useCapabilityGroupsFree(): CapabilityGroup[] {
  return NONE
}
