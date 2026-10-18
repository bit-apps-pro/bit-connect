import { __ } from '@common/helpers/i18nWrap'
import { Alert, Button } from 'antd'

interface Props {
  className?: string
  /** wp-admin's Permalinks screen, '' when the current user cannot open it. */
  permalinksUrl: string
}

/**
 * With plain permalinks WordPress has no rewrites, so no `/{slug}/…` address
 * of the community opens: the portal page itself answers only at `?page_id=`,
 * and every topic link falls through to the blog. Shown wherever the portal
 * address is chosen — the onboarding and the Location settings.
 */
export default function PlainPermalinksAlert({ className, permalinksUrl }: Props) {
  return (
    <Alert
      action={
        permalinksUrl && (
          <Button href={permalinksUrl} size="small">
            {__('Open Permalinks')}
          </Button>
        )
      }
      className={className}
      message={__(
        'Your site uses plain permalinks, so community addresses will not open. Choose any other structure in Settings → Permalinks.'
      )}
      showIcon
      type="error"
    />
  )
}
