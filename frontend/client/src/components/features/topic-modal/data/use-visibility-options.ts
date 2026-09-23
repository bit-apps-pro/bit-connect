import { IS_PRO_ACTIVE } from '@common/helpers/pro-access'

import useVisibilityOptionsFree from './use-visibility-options.free'
import useVisibilityOptionsPro from './use-visibility-options.pro'

export interface VisibilityOption {
  label: React.ReactNode
  value: string
}

/**
 * The visibility choices the topic form offers.
 *
 * An extension point rather than a branch. This plugin publishes topics, so its
 * implementation answers with Public and stops there — not "Public, and Private
 * greyed out", which would be a control with nothing behind it. This plugin has
 * no option, endpoint or setting for a topic visible only to its author; a
 * plugin that adds all three supplies the other sibling.
 *
 * Selected at module scope so the call site is a single unconditional hook call
 * and the rules of hooks still hold.
 *
 * @param currentStatus the status the topic already has, so an implementation
 *                      can keep offering a choice the topic is already using
 */
const useVisibilityOptions: (currentStatus?: string) => VisibilityOption[] = IS_PRO_ACTIVE
  ? useVisibilityOptionsPro
  : useVisibilityOptionsFree

export default useVisibilityOptions
