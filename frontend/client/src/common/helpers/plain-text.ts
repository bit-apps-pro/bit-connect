/**
 * Turning stored HTML into the plain text a card prints.
 *
 * Stripping tags is only half of it: the editor writes `>` as `&gt;`, and
 * React prints a string verbatim, so a stripped excerpt without decoding reads
 * "man&gt;&gt;" where the comment says "man>>". The decoder is a regex rather
 * than the DOM because the portal prerenders on the server, where there is no
 * `document` to hand it to.
 */

const NAMED: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’'
}

const fromCodePoint = (code: number, entity: string) =>
  Number.isInteger(code) && code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : entity

/**
 * Decodes character references once.
 *
 * One pass on purpose: `&amp;gt;` is a member who typed "&gt;", and decoding
 * the result again would turn their text into ">".
 */
export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value

  return value.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, ref: string) => {
    if (ref[0] !== '#') return NAMED[ref.toLowerCase()] ?? entity

    const hex = ref[1] === 'x' || ref[1] === 'X'
    return fromCodePoint(Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10), entity)
  })
}

/** Tags out, entities decoded, whitespace collapsed. */
export const plainText = (html: string) =>
  decodeEntities(html.replaceAll(/<[^>]*>/g, ' '))
    .replaceAll(/\s+/g, ' ')
    .trim()
