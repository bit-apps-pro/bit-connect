import { __ } from '@common/helpers/i18nWrap'
import { Tooltip, Typography } from 'antd'

import { ALL_FORUM_CAPABILITIES, type CapPopoverProps, type ForumUser } from '../shared/types'

/**
 * The Capabilities cell without the add-on.
 *
 * It still reports the truth — how many of the forum's capabilities this member
 * actually holds — because that number is worth reading whether or not anyone
 * can change it here, and it is what the Role Capabilities screen sets. The
 * count stays live rather than being blanked out: an admin looking for who can
 * moderate should not have to buy anything to find out.
 *
 * What it is not is a control. It used to be a Button with a crown that opened
 * the Buy Pro modal, sitting in the exact spot the per-user editor occupies in
 * the other edition — which reads as the editor with a lock on it rather than
 * as a column this plugin reports and does not edit. Inert text says the same
 * thing without the lock, and the heading is now the plain word Capabilities
 * in both editions: where the count comes from is the tooltip's job, not an
 * advert's.
 *
 * Takes the props of the editor it replaces and uses only `user`: the dispatch
 * hands both siblings the same object, and there is nothing here to save,
 * reset or disable.
 */
export default function CapabilityPopoverFree({ user }: CapPopoverProps) {
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
