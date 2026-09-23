import { __ } from '@common/helpers/i18nWrap'
import { Tooltip, Typography } from 'antd'

import { ALL_FORUM_CAPABILITIES, type CapPopoverProps, type ForumUser } from '../shared/types'

/**
 * The Capabilities cell.
 *
 * It reports how many of the forum's capabilities this member actually holds,
 * because that number is worth reading whether or not anyone can change it
 * here, and it is what the Role Capabilities screen sets.
 *
 * What it is not is a control. Inert text rather than a button: this plugin
 * sets capabilities per role, so a button here would promise a per-member
 * editor that does not exist. Where the count comes from is the tooltip's job.
 */
export default function CapabilityPopover({ user }: CapPopoverProps) {
  const activeCount = ALL_FORUM_CAPABILITIES.filter(cap => (user as ForumUser).capabilities[cap]).length

  return (
    <Tooltip title={__('Set by role, on the Role Capabilities screen.')}>
      <Typography.Text
        aria-label={__('Capabilities, set by role')}
        className="bc-flex bc-items-center bc-gap-1 bc-text-sm"
      >
        <span>{activeCount}</span>
        <span className="bc-text-ink-subtle">/</span>
        <span className="bc-text-ink-subtle">{ALL_FORUM_CAPABILITIES.length}</span>
      </Typography.Text>
    </Tooltip>
  )
}
