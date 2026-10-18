/**
 * One titled group of settings: a heading, a line saying what it governs, and
 * optionally a control opposite the heading that governs the whole card.
 *
 * The portal's copy of the admin screens' SectionCard, so a member's settings
 * read the same as the forum's own.
 */
export default function SettingsCard({
  ariaLabel,
  children,
  className,
  extra,
  subtitle,
  title
}: {
  /** Defaults to the title; set it when the title is not a plain string. */
  ariaLabel?: string
  children?: React.ReactNode
  className?: string
  /** Sits opposite the title — a switch or choice that governs the card. */
  extra?: React.ReactNode
  subtitle?: React.ReactNode
  title: string
}) {
  return (
    <section
      aria-label={ariaLabel ?? title}
      className={`bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-px-5 bc-py-5 sm:bc-px-6 ${className ?? ''}`}
    >
      {/* Wraps rather than squeezing: on a narrow card the control drops under
          the title instead of crushing it a letter per line. */}
      <div className="bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-4">
        <div className="bc-min-w-0 bc-flex-1 bc-basis-48">
          <h2 className="bc-m-0 bc-text-[19px] bc-font-medium bc-leading-snug bc-text-ink">{title}</h2>
          {subtitle && (
            <p className="bc-m-0 bc-mt-1 bc-text-[12px] bc-leading-relaxed bc-text-ink-subtle">
              {subtitle}
            </p>
          )}
        </div>
        {extra && <div className="bc-shrink-0 bc-pt-1">{extra}</div>}
      </div>
      {children && <div className="bc-mt-5">{children}</div>}
    </section>
  )
}
