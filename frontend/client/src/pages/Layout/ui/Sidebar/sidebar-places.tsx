import config from '@config/config'
import { FOLLOWING_PATH } from '@pages/following/following-path'
import useActiveStage from '@pages/Layout/data/use-active-stage'
import { useStagesStore } from '@pages/Layout/data/use-stages'
import StageIcon from '@utilities/stage-icon'
import { routePath } from '@utils/route-path'
import { theme } from 'antd'
import { type ReactNode } from 'react'
import { LuBookmarkCheck } from 'react-icons/lu'
import { matchPath, useLocation } from 'react-router'

import { __ } from '../../../../common/helpers/i18nWrap'
import { listingLink } from './listing-link'
import SidebarNavItem from './SidebarNavItem'

/**
 * The portal's stages, each opening the topic listing on that stage, and for
 * a member what they follow.
 */
export default function SidebarPlaces(): ReactNode {
  const { pathname } = useLocation()
  const stages = useStagesStore(state => state.stages)
  const activeStage = useActiveStage()

  return (
    <div className="bc-flex bc-flex-col bc-space-y-1">
      {stages.map(stage => (
        <SidebarNavItem
          key={stage.id}
          props={{
            glyph: (
              <StageIcon
                dark={stage.meta?.bit_connect_icon_dark_url}
                fallback={<StageDot color={stage.meta?.bit_connect_color} />}
                light={stage.meta?.bit_connect_icon_url}
              />
            ),
            isActive: activeStage === stage.slug,
            label: stage.name,
            path: stage.slug,
            reserveIconSlot: true,
            to: listingLink({ stage: stage.slug })
          }}
        />
      ))}
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

/** A stage's own colour, in place of an icon it does not have. */
function StageDot({ color }: { color?: string }) {
  const { token } = theme.useToken()

  return (
    <span
      aria-hidden
      className="bc-rounded-full"
      style={{ background: color || token.colorTextQuaternary, display: 'block', height: 9, width: 9 }}
    />
  )
}
