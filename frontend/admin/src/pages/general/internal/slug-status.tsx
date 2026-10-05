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

  // Whoever is asking, the answer is no: the portal would take over the
  // archives or the API that WordPress serves from this address.
  if (check.reserved) {
    return (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="danger">
        <LuCircleX className="bc-shrink-0" />
        {__('WordPress already uses this address for another part of your site. Please choose another.')}
      </Text>
    )
  }

  // No page here, and none can be made: a media file or another item already
  // holds this slug, so WordPress would store a new page as `name-2`.
  if (!check.exists && check.available === false) {
    return (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="danger">
        <LuCircleX className="bc-shrink-0" />
        {__(
          'Something else on your site, such as a media file, already uses this name. Please choose another.'
        )}
      </Text>
    )
  }

  if (mode === 'create') {
    // The wizard's own page from an earlier visit: nothing to create, nothing in the way.
    if (check.isPortal) {
      return (
        <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm bc-text-green-600">
          <LuCircleCheck className="bc-shrink-0" />
          {__('This is already your community page.')}
        </Text>
      )
    }

    return check.exists ? (
      <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm" type="danger">
        <LuCircleX className="bc-shrink-0" />
        {sprintf(__('A page already exists at %s. Please choose another name.'), check.url)}
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
            'There is no page at %s yet. Create one with the Bit Connect block or shortcode in it, or rename your community page to this slug.'
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
        {__(
          'A page exists here, but it does not contain the Bit Connect block or the [bit-connect] shortcode yet.'
        )}
      </Text>
    )
  }

  return (
    <Text className="bc-flex bc-items-center bc-gap-2 bc-text-sm bc-text-green-600">
      <LuCircleCheck className="bc-shrink-0" />
      {check.isPortal
        ? __('This is your community page.')
        : __('A page showing the community is ready here.')}
    </Text>
  )
}
