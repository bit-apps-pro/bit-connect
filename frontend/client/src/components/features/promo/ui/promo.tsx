import { cn } from '@common/helpers/globalHelpers'
import { useReducedMotion } from 'framer-motion'
import { LuArrowUpRight, LuSparkles } from 'react-icons/lu'

import { __ } from '@/common/helpers/i18nWrap'

import useTypewriter from '../data/use-typewriter'
import cls from './promo.module.css'

/**
 * Only a link the browser will follow as a link. An admin's URL reaches this
 * anchor, and while the server runs it through esc_url_raw first, a `javascript:`
 * href is worth refusing in both places rather than in whichever one is easier
 * to remember. Anything else and the card renders as plain text.
 */
const isFollowable = (url: string) => /^https?:\/\//i.test(url)

interface PromoProps {
  className?: string
  /** The link label on the bottom row. */
  cta?: string
  /** The top line, above the headline. */
  eyebrow?: string
  /** The headline: the line the card is really about. */
  headline?: string
  /** The rotating phrases, in the admin's order. */
  phrases?: string[]
  /** The static lead-in the phrases are typed after. */
  prefix?: string
  /** Where the card points. Without one it is not a link. */
  url?: string
}

/**
 * The promo card at the foot of the sider.
 *
 * Every word in it is the admin's, down to the lead-in and the link label:
 * nothing here has default copy, no string is translated on the card's behalf,
 * and a field left empty is a row the card does not have. All of them empty and
 * it renders nothing rather than an empty bordered box.
 *
 * The eyebrow and the headline are static, so whatever the card is for is
 * readable without waiting — only the tail of the third row animates.
 *
 * Rendered only where an admin switched it on (`config.PROMO.enabled`): it is an
 * outbound link on pages the site owner published.
 *
 * The typed row is `aria-hidden` and the anchor carries its own label — a span
 * mutating every 65ms is a live region as far as some screen readers are
 * concerned, and this is an advert, not an alert.
 */
export default function Promo({ className, cta, eyebrow, headline, phrases, prefix, url }: PromoProps) {
  const shouldReduceMotion = useReducedMotion()

  const topLine = eyebrow?.trim() ?? ''
  const title = headline?.trim() ?? ''
  const lead = prefix?.trim() ?? ''
  const label = cta?.trim() ?? ''
  const lines = phrases?.map(phrase => phrase.trim()).filter(Boolean) ?? []
  const href = url?.trim() ?? ''
  const isLink = href !== '' && isFollowable(href)
  const hasRotator = lead !== '' || lines.length > 0

  const { text } = useTypewriter(lines, { paused: !!shouldReduceMotion })

  // Nothing to say: the switch is on but every field is empty.
  if (topLine === '' && title === '' && label === '' && !hasRotator) return <></>

  const body = (
    <>
      <span aria-hidden className={cls.glow} />

      {topLine !== '' && (
        <span className="bc-relative bc-flex bc-items-center bc-gap-1.5 bc-text-[11px] bc-font-medium bc-uppercase bc-tracking-wide bc-text-ink-muted">
          <LuSparkles aria-hidden className="bc-shrink-0 bc-text-primary" size={12} />
          {topLine}
        </span>
      )}

      {title !== '' && (
        <span className="bc-relative bc-mt-1 bc-block bc-font-semibold bc-text-sm bc-text-ink">
          {title}
        </span>
      )}

      {/* min-h holds two rows open: a phrase long enough to wrap must not grow
          the card by a line mid-loop and shove the sider's layout around. */}
      {hasRotator && (
        <span
          aria-hidden
          className="bc-relative bc-mt-1 bc-block bc-min-h-[2rem] bc-text-[11px] bc-leading-[1.4] bc-text-ink-subtle"
        >
          {lead !== '' && `${lead} `}
          <span className="bc-font-medium bc-text-info">
            {text}
            <span className={cls.caret} />
          </span>
        </span>
      )}

      {label !== '' && (
        <span className="bc-relative bc-mt-1 bc-flex bc-items-center bc-gap-1 bc-text-[11px] bc-text-ink-subtle group-hover:bc-text-info">
          {label}
          {isLink && <LuArrowUpRight aria-hidden className={cn([cls.arrow, 'bc-shrink-0'])} size={12} />}
        </span>
      )}
    </>
  )

  const shell = cn([
    'bc-group bc-relative bc-block bc-overflow-hidden bc-no-underline',
    'bc-rounded-md bc-border bc-border-solid bc-border-line bc-px-3 bc-py-2.5',
    // Literal-hex `primary` is the one colour here that can take an alpha
    // modifier; the semantic tokens resolve to bare `var(--bc-*)` and Tailwind
    // drops the declaration if you try. See tokens.css.
    'bc-bg-gradient-to-br bc-from-primary/10 bc-via-transparent bc-to-primary/5',
    // cls.card owns the hover lift, the glow and the arrow nudge. Only a card
    // that goes somewhere should answer the pointer that way.
    isLink && [cls.card, 'hover:bc-border-primary/40 hover:bc-shadow-lg'],
    className
  ])

  // Without a URL there is nothing to follow, and an anchor without an href is
  // not a link to anything — the same card, minus the interaction.
  if (!isLink) {
    return <div className={shell}>{body}</div>
  }

  return (
    <a
      // Built from the admin's own rows: a screen reader should announce the card
      // that is actually on the page, and the typed row is hidden from it. The
      // new-tab warning is the one string here the admin does not own — it
      // describes the link's behaviour rather than the card's content.
      aria-label={`${[title, topLine, label].filter(Boolean).join(' — ')} (${__('opens in a new tab')})`}
      className={shell}
      href={href}
      rel="noreferrer noopener nofollow"
      target="_blank"
    >
      {body}
    </a>
  )
}
