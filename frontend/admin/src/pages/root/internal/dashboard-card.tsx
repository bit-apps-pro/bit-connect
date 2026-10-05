import { type ReactNode } from 'react'
import { LuArrowRight } from 'react-icons/lu'
import { Link } from 'react-router'

interface CardLink {
  label: string
  /** An admin route, e.g. `stages`, or an absolute URL, which opens in a new tab. */
  to: string
}

interface DashboardCardProps {
  children: ReactNode
  className?: string
  /** Sits opposite the title — a legend, or anything that is not a link. */
  extra?: ReactNode
  /**
   * The body runs edge to edge under a rule instead of inside the padding, for
   * a table whose rows should reach the card's sides.
   */
  flush?: boolean
  link?: CardLink
  subtitle?: ReactNode
  title: string
}

function CardLinkAnchor({ label, to }: CardLink) {
  const className =
    'bc-inline-flex bc-shrink-0 bc-items-center bc-gap-1 bc-text-sm bc-font-medium bc-text-primary hover:bc-underline'
  const content = (
    <>
      {label}
      <LuArrowRight aria-hidden className="bc-text-xs" />
    </>
  )

  if (/^https?:\/\//.test(to)) {
    return (
      <a className={className} href={to} rel="noreferrer" target="_blank">
        {content}
      </a>
    )
  }

  return (
    <Link className={className} to={to}>
      {content}
    </Link>
  )
}

/** One dashboard panel: a title row, then a body that is padded or flush. */
export default function DashboardCard({
  children,
  className,
  extra,
  flush,
  link,
  subtitle,
  title
}: DashboardCardProps) {
  return (
    <section
      className={`bc-flex bc-min-w-0 bc-flex-col bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface ${className ?? ''}`}
    >
      <header
        className={`bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-3 bc-px-6 bc-pt-5 ${
          flush ? 'bc-border-0 bc-border-b bc-border-solid bc-border-line bc-pb-4' : ''
        }`}
      >
        {/* A floor, so on a phone the legend or picker wraps under the title
            instead of squeezing it until its words run into them. */}
        <div className="bc-min-w-32 bc-flex-1">
          <h2 className="bc-m-0 bc-text-base bc-font-semibold bc-text-ink">{title}</h2>
          {subtitle && <div className="bc-mt-1 bc-text-xs bc-text-ink-subtle">{subtitle}</div>}
        </div>
        {extra}
        {link && <CardLinkAnchor {...link} />}
      </header>
      {/* A column, so a body that should take the card's whole height — the
          chart beside a taller card — can grow into it. */}
      <div className={`bc-flex bc-flex-1 bc-flex-col ${flush ? '' : 'bc-px-6 bc-pb-5 bc-pt-4'}`}>{children}</div>
    </section>
  )
}
