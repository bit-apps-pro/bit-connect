import { cn } from '@common/helpers/globalHelpers'
import config from '@config/config'
import bitAppsLogo from '@resource/img/bit-apps-logo.svg'
import { type ReactNode } from 'react'
import { LuSquareArrowOutUpRight } from 'react-icons/lu'

import { __ } from '@/common/helpers/i18nWrap'

/**
 * Only a link the browser will follow as a link. The server always sends its
 * own URL here, but a `javascript:` href is worth refusing in both places
 * rather than in whichever one is easier to remember. Anything else and the
 * credit renders as plain text.
 */
const isFollowable = (url: string) => /^https?:\/\//i.test(url)

interface PromoProps {
  className?: string
  /** The second line, beside the Bit Apps mark. */
  eyebrow?: string
  /** The first line: "Built with Bit Connect". */
  headline?: string
  /** Where the credit points. Without one it is not a link. */
  url?: string
}

/**
 * Picks the product name out of the headline in the brand colour. Matched on
 * the name rather than on the English sentence, so a translation that keeps
 * "Bit Connect" keeps the accent and one that does not simply reads plain.
 */
function withProductName(headline: string): ReactNode {
  const name = config.PRODUCT_NAME
  const at = headline.indexOf(name)

  if (at === -1) return headline

  return (
    <>
      {headline.slice(0, at)}
      <span className="bc-text-primary">{name}</span>
      {headline.slice(at + name.length)}
    </>
  )
}

/**
 * The Bit Apps credit at the foot of the sider: "Built with Bit Connect" over
 * the Bit Apps mark and "a Bit Apps product".
 *
 * Rendered only where an admin switched it on (`config.PROMO.enabled`): it is an
 * outbound link on pages the site owner published. A line with no copy is a
 * line the credit does not have; both empty and it renders nothing.
 */
export default function Promo({ className, eyebrow, headline, url }: PromoProps) {
  const title = headline?.trim() ?? ''
  const byline = eyebrow?.trim() ?? ''
  const href = url?.trim() ?? ''
  const isLink = href !== '' && isFollowable(href)

  if (title === '' && byline === '') return <></>

  const body = (
    <>
      {title !== '' && (
        <span className="bc-block bc-font-semibold bc-text-sm bc-text-ink-muted">
          {withProductName(title)}
        </span>
      )}

      {byline !== '' && (
        <span className="bc-mt-1 bc-flex bc-items-center bc-gap-1.5 bc-text-xs bc-text-ink-subtle">
          <img alt="" className="bc-size-4 bc-shrink-0" src={bitAppsLogo} />
          <span className={cn([isLink && 'group-hover:bc-underline'])}>{byline}</span>
          {isLink && (
            <LuSquareArrowOutUpRight aria-hidden className="bc-shrink-0" size={13} />
          )}
        </span>
      )}
    </>
  )

  const shell = cn(['bc-group bc-block bc-no-underline', className])

  if (!isLink) {
    return <div className={shell}>{body}</div>
  }

  return (
    <a
      aria-label={`${[title, byline].filter(Boolean).join(', ')} (${__('opens in a new tab')})`}
      className={shell}
      href={href}
      rel="noreferrer noopener nofollow"
      target="_blank"
    >
      {body}
    </a>
  )
}
