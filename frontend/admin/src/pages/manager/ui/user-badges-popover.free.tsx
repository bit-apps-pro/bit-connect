import { __ } from '@common/helpers/i18nWrap'
import { Typography } from 'antd'

/**
 * The Badges cell without the pro add-on.
 *
 * The column stays rather than disappearing, so the free and pro builds lay the
 * table out identically. The cell itself is inert and says only that there is
 * nothing here: the upsell lives once in the column heading, not once per
 * member, and a cell that looks clickable but cannot do anything is worse than
 * an empty one. It takes no props — there is no catalog to show and nothing to
 * save.
 */
export default function UserBadgesPopoverFree() {
  return (
    <Typography.Text aria-label={__('No badges')} className="bc-text-sm" type="secondary">
      —
    </Typography.Text>
  )
}
