import { __ } from '@common/helpers/i18nWrap'
import { createElement as h } from 'react'
import { LuGlobe } from 'react-icons/lu'

export interface VisibilityOption {
  label: React.ReactNode
  value: string
}

/**
 * Public, and nothing else.
 *
 * A constant, built once: this plugin has no option, endpoint or setting for a
 * topic visible only to its author, so there is no second choice for this to
 * depend on — and not "Public, and Private greyed out", which would be a
 * control with nothing behind it. The form hides the radio group entirely when
 * only one option comes back, while still registering `publish`, so the request
 * body is the same either way.
 */
const PUBLIC_ONLY: VisibilityOption[] = [
  {
    label: h(
      'div',
      { className: 'bc-flex bc-items-center bc-gap-2' },
      h(LuGlobe, { size: 16 }),
      __('Public Topic')
    ),
    value: 'publish'
  }
]

/**
 * The visibility choices the topic form offers.
 *
 * @param currentStatus the status the topic already has, so an implementation
 *                      can keep offering a choice the topic is already using
 */
export default function useVisibilityOptions(_currentStatus?: string): VisibilityOption[] {
  return PUBLIC_ONLY
}
