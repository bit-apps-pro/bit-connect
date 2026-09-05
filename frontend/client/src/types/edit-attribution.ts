/**
 * Who last edited a topic or comment, as resolved server-side by
 * `EditAttributionService`. Null on anything nobody has edited.
 *
 * Two readings come out of one record, and `byAuthor` picks between them: an
 * author editing their own words gets the plain "(edited)" every forum shows,
 * while a colleague correcting a teammate's reply gets a byline naming them.
 */
export interface EditAttribution {
  /** GMT, `YYYY-MM-DD HH:MM:SS`. */
  at: string
  /** True when the editor is the content's own author. */
  byAuthor: boolean
  /** Editor's display name. Empty when their account has since been deleted. */
  byName: string
  /** Editor's profile slug, for linking the name. Empty alongside `byName`. */
  bySlug: string
}

/** The wire shape, before it is camel-cased into `EditAttribution`. */
export interface EditAttributionResponse {
  at: string
  by: number
  by_author: boolean
  by_name: string
  by_slug: string
}

/**
 * Normalises the payload, dropping anything the server did not send.
 *
 * The argument is optional so a caller can hand over a field that may not be on
 * an older payload at all, without a guard of its own at every call site.
 */
export function toEditAttribution(raw?: EditAttributionResponse | null): EditAttribution | undefined {
  if (!raw?.at) return undefined

  return {
    at: raw.at,
    byAuthor: raw.by_author,
    byName: raw.by_name,
    bySlug: raw.by_slug
  }
}
