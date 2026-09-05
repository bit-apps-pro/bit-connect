import { __, sprintf } from '@common/helpers/i18nWrap'
import { Spin, Typography } from 'antd'
import { LuCircleAlert, LuCircleCheck, LuCircleX } from 'react-icons/lu'

import { type SlugCheck } from '../data/use-check-slug'

const { Text } = Typography

interface SlugStatusProps {
  check: SlugCheck | undefined
  isChecking: boolean
  /**
   * What "a page is already there" means for the caller. The wizard is about
   * to create one, so an occupant is a conflict; the settings screen points at
   * pages the administrator made, so an occupant is what it wants.
   */
  mode: 'create' | 'point'
}

/**
 * The live verdict under a slug field: what, if anything, answers to it.
 */
export default function SlugStatus({ check, isChecking, mode }: SlugStatusProps) {
  if (isChecking) {
    return (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="secondary">
        <Spin size="small" /> {__('Checking…')}
      </Text>
    )
  }

  if (!check) {
    return
  }

  if (mode === 'create') {
    return check.exists ? (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="danger">
        <LuCircleX className="bc-shrink-0" />
        {check.isPortal
          ? __('This is already your community page.')
          : sprintf(__('A page already exists at %s. Please choose another name.'), check.url)}
      </Text>
    ) : (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm bc-text-green-600">
        <LuCircleCheck className="bc-shrink-0" />
        {sprintf(__('%s is available. Your community page will be created here.'), check.url)}
      </Text>
    )
  }

  if (!check.exists) {
    return (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="warning">
        <LuCircleAlert className="bc-shrink-0" />
        {sprintf(
          __(
            'There is no page at %s yet. Create one with the shortcode in it, or rename your community page to this slug.'
          ),
          check.url
        )}
      </Text>
    )
  }

  if (!check.hasShortcode) {
    return (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="warning">
        <LuCircleAlert className="bc-shrink-0" />
        {__('A page exists here, but it does not contain the [bit-connect] shortcode yet.')}
      </Text>
    )
  }

  return (
    <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm bc-text-green-600">
      <LuCircleCheck className="bc-shrink-0" />
      {check.isPortal
        ? __('This is your community page.')
        : __('A page with the shortcode is ready here.')}
    </Text>
  )
}
