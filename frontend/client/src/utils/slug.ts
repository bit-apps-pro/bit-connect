/**
 * WordPress stores a post slug percent-encoded. `sanitize_title()` runs the
 * title through `utf8_uri_encode()` and its final cleanup keeps `%`, so
 * anything outside ASCII is preserved as escaped octets rather than dropped —
 * "Hello 🔥 world" is stored as `hello-%f0%9f%94%a5-world`, and a Bengali or
 * Arabic title the same way. That is deliberate in core: it is what makes
 * non-Latin permalinks work.
 *
 * So a slug legitimately exists in two forms — encoded in the database and in
 * the URL, decoded once the router hands the route param back. Core settles
 * that by normalising before it matches (`get_page_by_path()` runs the path
 * through `urldecode()`, `sanitize_title_for_query()` re-encodes it). These
 * mirror that step for the client, which otherwise compares the two forms with
 * `===` and never matches.
 */
export const decodeSlug = (slug: string): string => {
  try {
    return decodeURIComponent(slug)
  } catch {
    // Not valid encoding — a bare `%` survives `sanitize_title()`, which only
    // strips percent signs that are not part of an octet. Compare it as it came.
    return slug
  }
}

/**
 * True when two slugs name the same topic, whichever form each arrived in.
 */
export const isSameSlug = (first: string, second: string): boolean =>
  decodeSlug(first) === decodeSlug(second)

/**
 * Where to send the browser after a topic's slug changed, or undefined to stay.
 *
 * A topic is addressed by its slug, so renaming one strands the address bar on
 * a slug that no longer resolves: PostDetailsPage compares the route against
 * the store, finds they disagree, and sits on the skeleton for good.
 *
 * Only the page being renamed moves. The edit modal is mounted in the layout
 * and could be opened from anywhere, and a reader on the topic list must not be
 * yanked onto a topic just because they edited it.
 *
 * @param pathname     the router's current path, basename already stripped
 * @param previousSlug the slug the topic had before the save
 * @param nextSlug     the slug the *server* returned — never the typed one,
 *                     which has not been sanitized or de-duplicated yet
 */
export const slugRedirectPath = (
  pathname: string,
  previousSlug: string,
  nextSlug: string
): string | undefined => {
  if (!nextSlug || isSameSlug(nextSlug, previousSlug)) return undefined
  if (!isSameSlug(pathname.replace(/^\//, ''), previousSlug)) return undefined

  return `/${nextSlug}`
}

/**
 * The readable form of the slug WordPress will store for a piece of text.
 *
 * Follows core's `cleanForSlug()`: letters and numbers in *any* script survive,
 * so a Bengali or Arabic title still yields a slug the author can read and
 * edit. `sanitize_title()` on the server is authoritative and percent-encodes
 * whatever is left outside ASCII — see the note at the top of this file — so
 * this only has to agree with it on the decoded form.
 *
 * Two deliberate departures from the JS in core, both to avoid corrupting the
 * scripts `sanitize_title()` preserves intact:
 *
 * - Combining marks are kept. An Indic vowel sign is a mark, not a letter, so
 *   `\p{L}\p{N}` alone turns "সমস্যা" into "সমসয" — a different word.
 * - The result is recomposed to NFC, undoing the decomposition the accent strip
 *   needs, so the slug matches the server's byte-for-byte instead of merely
 *   rendering the same.
 *
 * Returns '' for input with nothing sluggable in it; callers treat that as
 * "let the server derive one from the title".
 */
export const slugify = (value: string): string =>
  value
    .normalize('NFKD')
    .replaceAll(/[̀-ͯ]/g, '') // drop the accents NFKD split off
    .replaceAll(/[\s./]+/g, '-')
    .replaceAll(/[^\p{L}\p{M}\p{N}_-]+/gu, '')
    .toLowerCase()
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .normalize('NFC')

/**
 * Whether the server stored a different slug than the author asked for.
 *
 * A clash never fails the save: `wp_insert_post()` runs the slug through
 * `wp_unique_post_slug()`, which quietly appends `-2`. Left unsaid, the author
 * walks away believing the topic is at the URL they typed. The availability
 * check in the form warns earlier, but it reserves nothing — two authors can
 * both be told a slug is free — so this is what actually closes the gap.
 *
 * Only a slug the author chose counts. Left blank, the server derives one from
 * the title, which was never a promise to keep.
 *
 * @param requested what was submitted, raw — the field is only normalized on blur
 * @param stored    the `post_name` the server sent back, possibly percent-encoded
 */
export const wasSlugTaken = (requested: string, stored: string): boolean => {
  const wanted = slugify(requested)
  if (!wanted || !stored) return false

  return !isSameSlug(wanted, stored)
}
