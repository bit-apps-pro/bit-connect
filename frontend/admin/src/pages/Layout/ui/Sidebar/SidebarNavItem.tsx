import { theme } from 'antd'
import { motion } from 'framer-motion'
import { memo } from 'react'
import { type IconType } from 'react-icons'
import { NavLink } from 'react-router'

import { cn } from '../../../../common/helpers/globalHelpers'
import If from '../../../../components/utilities/If'
import { navItemStyle } from './SidebarNavItem.style'

interface SidebarNavProps {
  props: {
    icon?: IconType
    label: JSX.Element | string
    path: string
  }
}
export default memo(SidebarNavItem)
function SidebarNavItem({ props: { icon: Icon, label, path } }: SidebarNavProps) {
  const { token } = theme.useToken()

  return (
    <NavLink
      className={cn([
        'bc-relative bc-z-0 bc-flex bc-h-9 bc-cursor-pointer bc-items-center bc-gap-2.5 bc-text-sm',
        'bc-ring-slate-900 focus-visible:bc-ring dark:bc-ring-slate-50'
      ])}
      style={({ isActive }) => navItemStyle({ isActive, token })}
      to={path}
    >
      {({ isActive }) => (
        <>
          {Icon && <Icon aria-hidden className="bc-shrink-0" size={16} />}
          {label}

          <If conditions={isActive}>
            <motion.span
              className="bc-absolute bc-inset-0 bc--z-10 bc-h-full bc-w-full bc-rounded-md bc-bg-primary/10"
              layoutId="sidebar-nav-item-active"
            />
          </If>
        </>
      )}
    </NavLink>
  )
}
