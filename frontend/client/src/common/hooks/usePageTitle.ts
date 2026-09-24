import config from '@config/config'
import { useEffect } from 'react'

/**
 * The browser tab's title, for the page the app is showing.
 *
 * The server sets `<title>` for the URL it renders, but after that the app
 * moves between pages without a reload, so the tab kept the first page's title
 * for the rest of the visit. Each page states its own here, in the form the
 * server uses: "Part — Community", or the community name alone for the list.
 *
 * Nothing is done while `part` is undefined, so a page still loading its data
 * leaves the previous title in place rather than flashing a bare one.
 */
export function pageTitle(part = ''): string {
  const community = config.COMMUNITY_TITLE || config.SITE_NAME

  if (part === '') return community
  if (community === '') return part

  return `${part} — ${community}`
}

export default function usePageTitle(part: string | undefined) {
  useEffect(() => {
    if (part === undefined || typeof document === 'undefined') return

    document.title = pageTitle(decodeEntities(part))
  }, [part])
}

/**
 * Term names and titles arrive from WordPress escaped (`API &amp; Billing`),
 * and `document.title` is plain text, so they would show the entity verbatim.
 */
function decodeEntities(value: string): string {
  if (!value.includes('&')) return value

  const textarea = document.createElement('textarea')
  textarea.innerHTML = value

  return textarea.value
}
