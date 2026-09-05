import { __ } from '@common/helpers/i18nWrap'
import { Button, Tooltip } from 'antd'
import { useSetAtom } from 'jotai'
import { LuCrown } from 'react-icons/lu'

import { $isBuyProModalOpen } from '@/common/globalStates/$buyPro'

import { ALL_FORUM_CAPABILITIES, type ForumUser } from '../shared/types'
import { type CapPopoverProps } from './capability-popover.pro'

/**
 * The Capabilities cell without the add-on.
 *
 * It still reports the truth — how many of the forum's capabilities this member
 * actually holds — because that number is worth reading whether or not anyone
 * can change it here, and it is what the Role Capabilities screen sets. What it
 * does not offer is the per-user editor.
 *
 * The count stays live rather than being blanked out: an admin looking for who
 * can moderate should not have to buy anything to find out, and the free forum
 * still decides all of this by role.
 */
export default function CapabilityPopoverFree({ user }: CapPopoverProps) {
  const setBuyProOpen = useSetAtom($isBuyProModalOpen)

  const activeCount = ALL_FORUM_CAPABILITIES.filter(cap => (user as ForumUser).capabilities[cap]).length

  return (
    <Tooltip
      title={__('Per-user capability overrides are a Pro feature. Set defaults per role instead.')}
    >
      <Button
        aria-label={__('Capabilities, set by role')}
        className="bc-flex bc-items-center bc-gap-1"
        onClick={() => setBuyProOpen(true)}
        size="small"
      >
        <span>{activeCount}</span>
        <span className="bc-text-ink-subtle">/</span>
        <span className="bc-text-ink-subtle">{ALL_FORUM_CAPABILITIES.length}</span>
        <LuCrown className="bc-ml-1 bc-text-ink-subtle" size={12} />
      </Button>
    </Tooltip>
  )
}
