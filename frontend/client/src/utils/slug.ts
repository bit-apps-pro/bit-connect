import { routePath } from './route-path'

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
  // Either permalink form: the address bar carries the site's, trailing slash
  // or not.
  if (!isSameSlug(pathname.replaceAll(/^\/|\/+$/g, ''), previousSlug)) return undefined

  return routePath(`/${nextSlug}`)
}

/** What `sanitize_title_with_dashes()` strips outright, decoded. */
const STRIPPED_CHARACTERS =
  /[\u00AD\u00A1\u00BF\u00AB\u00BB\u2039\u203A\u2018\u2019\u201C\u201D\u201A\u201B\u201E\u201F\u2022\u00A9\u00AE\u00B0\u2026\u2122\u00B4\u02CA\u200B-\u200F\u202A-\u202E\uFEFF\uFFFC]|\u0300|\u0301|\u0304|\u030C|\u0341/g

/** Latin letters `remove_accents()` spells out rather than decomposes. */
const LATIN_LIGATURES: Record<string, string> = {
  ª: 'a',
  Æ: 'AE',
  æ: 'ae',
  Đ: 'D',
  đ: 'd',
  Ð: 'D',
  ð: 'd',
  Ħ: 'H',
  ħ: 'h',
  Ĳ: 'IJ',
  ĳ: 'ij',
  ı: 'i',
  Ł: 'L',
  ł: 'l',
  Ŀ: 'L',
  ŀ: 'l',
  Ŋ: 'N',
  ŋ: 'n',
  º: 'o',
  Ø: 'O',
  ø: 'o',
  Œ: 'OE',
  œ: 'oe',
  ĸ: 'k',
  ſ: 's',
  ß: 's',
  Ŧ: 'T',
  ŧ: 't',
  Þ: 'TH',
  þ: 'th',
  ŉ: 'N'
}

/**
 * `remove_accents()`: Latin letters lose their diacritics; other scripts are
 * left alone. Scoped to Latin on purpose — core's table has no entry for a
 * Cyrillic й or an Indic vowel sign, and stripping those would change the word.
 * Recomposed to NFC so the slug matches the server's byte-for-byte.
 */
const removeAccents = (value: string): string =>
  value
    .normalize('NFD')
    .replaceAll(/(\p{Script=Latin})[̀-ͯ]+/gu, '$1')
    .normalize('NFC')
    .replaceAll(/[ÆæÐðĐđĦħıĲĳĸĿŀŁłŉŊŋØøŒœßſÞþŦŧªº]/g, ch => LATIN_LIGATURES[ch] ?? ch)

/**
 * The readable form of the slug WordPress will store for a piece of text.
 *
 * Mirrors `sanitize_title()` in its 'save' context (`remove_accents()` then
 * `sanitize_title_with_dashes()`), step for step, on the decoded form — see the
 * note at the top of this file. The server stays authoritative; this exists so
 * the slug the form shows is the one the save will store.
 *
 * That means ASCII is held to letters, digits, `_` and `-`, while everything
 * outside ASCII survives — not just letters in any script, but emoji and
 * symbols too: "Hello 🔥 world" → "hello-🔥-world", as WordPress stores it.
 * Only the handful of typographic characters core names are stripped or turned
 * into hyphens. Not `cleanForSlug()` from the block editor, which drops emoji
 * and so disagrees with the server whenever a title carries one.
 *
 * Returns '' for input with nothing sluggable in it; callers treat that as
 * "let the server derive one from the title".
 */
export const slugify = (value: string): string =>
  removeAccents(value.replaceAll(/<[^>]*>/g, ''))
    .toLowerCase()
    .replaceAll(/[\u00A0\u2011\u2013\u2014/]/g, '-')
    .replaceAll(/&(?:nbsp|#8209|#160|ndash|#8211|mdash|#8212);/g, '-')
    .replaceAll(STRIPPED_CHARACTERS, '')
    .replaceAll(/[\u2000-\u200A\u2028\u2029\u202F]/g, '-')
    .replaceAll('\u00D7', 'x')
    .replaceAll(/&.+?;/g, '')
    .replaceAll('.', '-')
    // ASCII outside `[a-z0-9 _-]` goes; nothing above ASCII is touched here.
    .replaceAll(/(?![a-z0-9 _-])[\0-\u007F]/g, '')
    .replaceAll(/ +/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')

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
