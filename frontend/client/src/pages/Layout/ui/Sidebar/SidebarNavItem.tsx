import { cn } from '@common/helpers/globalHelpers'
import useActiveStage from '@pages/Layout/data/use-active-stage'
import If from '@utilities/If'
import { theme } from 'antd'
import { motion } from 'framer-motion'
import { memo, useState } from 'react'
import { NavLink } from 'react-router'

import { listingLink } from './listing-link'
import { navItemStyle } from './SidebarNavItem.style'

interface SidebarNavProps {
  props: {
    /** The department open alongside, which a stage row keeps. */
    department?: string
    icon?: string
    /** Overrides the stage match below, for rows that are not stages. */
    isActive?: boolean
    label: JSX.Element | string
    path: string
    /**
     * Hold the icon column open on rows that have no icon, so labels line up.
     * Set only when some stage in the list has one — reserving it
     * unconditionally would indent every row on the many portals that use no
     * stage icons at all.
     */
    reserveIconSlot?: boolean
    /** Overrides the stage archive URL below, for rows that are not stages. */
    to?: string
  }
}
export default memo(SidebarNavItem)
function SidebarNavItem({
  props: { department, icon, isActive: isActiveOverride, label, path, reserveIconSlot, to: toOverride }
}: SidebarNavProps) {
  const { token } = theme.useToken()
  // The URL of an icon that failed to load, so a stage whose attachment was
  // deleted from the media library falls back to its name instead of showing a
  // broken-image glyph. Stored as the URL rather than a boolean so re-pointing
  // the stage at a working icon retries it without needing to reset.
  const [brokenIcon, setBrokenIcon] = useState<string>()

  // Not read off `?stage=` alone: a topic URL carries no query string, so the
  // reader's stage has to be recovered from the topic itself. See the hook.
  const activeStage = useActiveStage()
  const isActive = isActiveOverride ?? activeStage === path

  // The stage archive's own path, not `/?stage=`: the sidebar is the portal's
  // primary navigation, so the URLs it hands out are the ones that get shared,
  // crawled and ranked — and a path segment is a page in its own right, where a
  // query string is a filtered view of the portal page that canonicalises away.
  //
  // The default stage is the exception: `/stage/questions` lists exactly what
  // `/` already lists, so pointing at it would put the portal's busiest page
  // behind a second URL. The server 301s that archive back here, and this keeps
  // the nav from relying on the redirect. `?stage=` still works for links
  // already shared — see pages/topics/topics.tsx.
  //
  // With a department open the row narrows that department instead of leaving
  // it, since the sidebar is the only place either choice is made.
  const to = toOverride ?? listingLink({ department, stage: path })

  return (
    <NavLink
      className={cn([
        // h-11 keeps the row at the 44px minimum touch target on phones.
        'bc-relative bc-z-0 bc-flex bc-h-11 bc-w-full bc-cursor-pointer bc-items-center bc-gap-2 bc-font-medium bc-text-base bc-bg-transparent bc-border-none bc-text-left bc-outline-none'
      ])}
      style={navItemStyle({ isActive, token })}
      to={to}
    >
      {icon && brokenIcon !== icon ? (
        <img
          alt=""
          // Rendered as uploaded, no filter. A dark glyph that would disappear
          // against the dark sider is answered by uploading a dark-mode icon
          // for the term, not by tracing artwork the admin did not ask for.
          className="bc-h-5 bc-w-5 bc-shrink-0 bc-object-contain"
          onError={() => setBrokenIcon(icon)}
          src={icon}
        />
      ) : (
        reserveIconSlot && <span aria-hidden className="bc-h-5 bc-w-5 bc-shrink-0" />
      )}
      {/* Truncates rather than spills: the row height never grows, and an icon
          takes 28px of a sider that is only 250px wide to begin with. */}
      <span className="bc-min-w-0 bc-truncate">{label}</span>

      <If conditions={isActive}>
        <motion.span
          className="bc-absolute bc-inset-0 bc--z-10 bc-h-full bc-w-full bc-rounded-md bc-bg-primary/10 bc-border bc-border-solid bc-border-primary/30"
          // One pill per section: a stage and a product can both be current
          // (`/?product=`), and a shared id would fling one pill between them.
          layoutId={toOverride ? 'sidebar-nav-other-active' : 'sidebar-nav-item-active'}
        />
      </If>
    </NavLink>
  )
}
