/**
 * Breaks anywhere, not just between words: in an auto-layout table a single
 * unbroken word otherwise sets the column's minimum width and stretches the
 * table far past its card. Inline because Tailwind has no utility for
 * `anywhere`, and prefixed arbitrary properties are not generated here.
 */
const WRAP = { overflowWrap: 'anywhere' } as const

/** A topic's title, opening the topic on the portal in a new tab. */
export default function TopicTitleLink({ title, url }: { title: string; url: string }) {
  if (!url)
    return (
      <span className="bc-font-medium" style={WRAP}>
        {title}
      </span>
    )

  return (
    <a
      className="bc-font-medium bc-text-ink hover:bc-text-primary hover:bc-underline"
      href={url}
      rel="noreferrer"
      style={WRAP}
      target="_blank"
    >
      {title}
    </a>
  )
}
