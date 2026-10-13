import config from '@config/config'
import { FOLLOWING_PATH } from '@pages/following/following-path'
import { ROADMAP_PATH } from '@pages/roadmap/roadmap-path'
import { isListingPath } from '@utils/listing-path'
import { routePath } from '@utils/route-path'
import { type ReactNode } from 'react'
import { LuBookmarkCheck, LuKanban, LuLayoutList } from 'react-icons/lu'
import { matchPath, useLocation } from 'react-router'

import { __ } from '../../../../common/helpers/i18nWrap'
import { sectionOwnsPath } from './sidebar-sections'
import SidebarNavItem from './SidebarNavItem'

export interface SidebarPlacesProps {
  /** The portal has stages past the one new topics land in, for the roadmap to lay out. */
  showRoadmap: boolean
}

/**
 * Whether a path is the archive of a term that can be followed — a tag's page.
 *
 * Such a page is a place of its own, reached from a tag chip, a search or the
 * Following page, so no sidebar row claims it. Stage, status and topic-type
 * archives stay the Topics row's: they are the listing's own pickers.
 */
const isFollowableArchive = (pathname: string): boolean => {
  const segments = pathname.split('/').filter(Boolean)

  return segments.length === 2 && (config.PORTAL_ARCHIVES[segments[0]]?.follow ?? '') !== ''
}

/**
 * The places a reader can go: the topic listing, once there are stages to lay
 * out the roadmap, and for a member what they follow. Places only — which
 * stage or archive the listing shows is the listing's own picker, so nothing
 * here doubles as a filter.
 */
export default function SidebarPlaces({ showRoadmap }: SidebarPlacesProps): ReactNode {
  const { pathname } = useLocation()

  return (
    <div className="bc-flex bc-flex-col bc-space-y-1">
      <SidebarNavItem
        props={{
          glyph: <LuLayoutList size={18} />,
          isActive: isListingPath(pathname) && !sectionOwnsPath?.(pathname) && !isFollowableArchive(pathname),
          label: __('Topics'),
          path: '',
          reserveIconSlot: true,
          to: '/'
        }}
      />
      {showRoadmap && (
        <SidebarNavItem
          props={{
            glyph: <LuKanban size={18} />,
            isActive: matchPath(ROADMAP_PATH, pathname) !== null,
            label: __('Roadmap'),
            path: ROADMAP_PATH,
            reserveIconSlot: true,
            to: routePath(ROADMAP_PATH)
          }}
        />
      )}
      {/* The member's own list, so not offered to a guest. */}
      {config.IS_LOGGED_IN && (
        <SidebarNavItem
          props={{
            glyph: <LuBookmarkCheck size={18} />,
            isActive: matchPath(FOLLOWING_PATH, pathname) !== null,
            label: __('Following'),
            path: FOLLOWING_PATH,
            reserveIconSlot: true,
            to: routePath(FOLLOWING_PATH)
          }}
        />
      )}
    </div>
  )
}
