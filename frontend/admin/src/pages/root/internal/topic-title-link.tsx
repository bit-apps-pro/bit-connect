/** A topic's title, opening the topic on the portal in a new tab. */
export default function TopicTitleLink({ title, url }: { title: string; url: string }) {
  if (!url) return <span className="bc-font-medium">{title}</span>

  return (
    <a
      className="bc-font-medium bc-text-ink hover:bc-text-primary hover:bc-underline"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      {title}
    </a>
  )
}
