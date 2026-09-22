import { __ } from '@common/helpers/i18nWrap'
import { createElement as h } from 'react'
import { LuGlobe } from 'react-icons/lu'

import { type VisibilityOption } from './use-visibility-options'

/**
 * Public, and nothing else.
 *
 * A constant, built once: without the add-on there is no second choice for this
 * to depend on. The form hides the radio group entirely when only one option
 * comes back — a control with nothing to decide is not a control — while still
 * registering `publish`, so the request body is the same either way.
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

export default function useVisibilityOptionsFree(): VisibilityOption[] {
  return PUBLIC_ONLY
}
