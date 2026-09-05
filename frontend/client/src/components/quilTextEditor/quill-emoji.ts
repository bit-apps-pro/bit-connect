/**
 * WordPress emoji images ↔ plain emoji characters.
 *
 * WordPress ships `wp-emoji-release.min.js` on every front-end page. When the
 * browser fails its emoji-support probe the script walks the DOM — including a
 * contenteditable — and swaps each emoji character for
 * `<img class="emoji" src="https://s.w.org/images/core/emoji/…/1f600.svg">`.
 *
 * Two things then go wrong for us:
 *
 *  - The formatters strip every attribute but `src`/`alt` before storing, so the
 *    `class="emoji"` that WordPress's own `height:1em` rule keys off is gone.
 *    The stored comment holds a plain `<img>`, which the content styles then
 *    size like a posted photo — a 😀 rendering 200px wide.
 *  - A handful of emoji count as images. Six of them tripped the "too many
 *    images" limit on a comment carrying no pictures at all.
 *
 * Turning those images back into the characters they stand for fixes both, and
 * stores what the author actually typed.
 */

/** WordPress and Twemoji both serve from a path containing this segment. */
const EMOJI_SRC_PATTERN = /(?:\/images\/core\/emoji\/|\/twemoji\/|\btwemoji\b)/i

/** Emoji classes WordPress puts on its replacements. */
const EMOJI_CLASS_PATTERN = /(?:^|\s)(?:emoji|wp-smiley)(?:\s|$)/i

/** `…/svg/1f1e7-1f1e9.svg` → the codepoints making up the character. */
const CODEPOINTS_PATTERN = /\/([\da-f]{2,6}(?:-[\da-f]{2,6})*)\.(?:svg|png)$/i

/** Anything the Unicode tables consider a picture character. */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u

/**
 * One rendered emoji, however many codepoints it takes: a flag is a pair of
 * regional indicators, a keycap is a digit plus a combining mark, and a family
 * is several pictographs joined by zero-width joiners. Matching whole sequences
 * is what makes "how many emoji is this" agree with what the reader sees.
 */
const EMOJI_SEQUENCE = new RegExp(
  [
    String.raw`\p{Regional_Indicator}{2}`,
    String.raw`[\d#*]\uFE0F?\u20E3`,
    String.raw`\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*` +
      String.raw`(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|[\u{1F3FB}-\u{1F3FF}])*)*`
  ].join('|'),
  'gu'
)

/**
 * Pictographs that also read as ordinary punctuation — ©, ®, ™, ‼ and the
 * dingbats. A comment of "©" is text, not an emoji reaction, so the enlarging
 * rule asks for at least one character from the emoji planes proper.
 */
const TRUE_EMOJI = /[\u{1F000}-\u{1FFFF}]|\p{Regional_Indicator}/u

/** True when this element is a WordPress emoji replacement rather than a picture. */
export function isEmojiImage(element: Element): boolean {
  if (element.tagName.toLowerCase() !== 'img') return false

  const className = element.getAttribute('class') ?? ''
  if (EMOJI_CLASS_PATTERN.test(className)) return true

  return EMOJI_SRC_PATTERN.test(element.getAttribute('src') ?? '')
}

/**
 * The character an emoji image stands for.
 *
 * `alt` is what WordPress writes and is trusted first. Comments stored before
 * this ran may have lost it, so the codepoints in the filename are the fallback
 * — that is what the URL encodes.
 */
export function emojiTextFor(element: Element): string {
  const alt = element.getAttribute('alt') ?? ''
  if (alt && PICTOGRAPHIC.test(alt)) return alt

  const match = CODEPOINTS_PATTERN.exec(element.getAttribute('src') ?? '')
  if (match) {
    try {
      return String.fromCodePoint(...match[1].split('-').map(part => Number.parseInt(part, 16)))
    } catch {
      // A path that merely looks like codepoints but decodes to nothing valid.
    }
  }

  return alt
}

/**
 * Replace every emoji image under `root` with its character, in place.
 *
 * Returns how many were replaced so callers can skip work when there were none.
 */
export function replaceEmojiImages(root: ParentNode): number {
  const images = [...root.querySelectorAll('img')].filter(image => isEmojiImage(image))

  for (const image of images) {
    // Without a character to put back, dropping the image still beats leaving a
    // bare emoji sprite behind to be styled as a photo.
    image.replaceWith(image.ownerDocument.createTextNode(emojiTextFor(image)))
  }

  return images.length
}

/**
 * Number of emoji in a string, counting a flag, a keycap or a skin-toned face as
 * the one character it renders as.
 */
export function countEmoji(text: string): number {
  return [...text.matchAll(EMOJI_SEQUENCE)].length
}

/**
 * Whether a comment is nothing but a few emoji — the case Facebook renders
 * large. Anything with words in it, or with a crowd of emoji, stays at reading
 * size.
 */
export function isEmojiOnly(text: string, max = 3): boolean {
  const trimmed = text.trim()
  if (!trimmed || !TRUE_EMOJI.test(trimmed)) return false
  if (trimmed.replaceAll(EMOJI_SEQUENCE, '').trim() !== '') return false

  const count = countEmoji(trimmed)
  return count > 0 && count <= max
}
