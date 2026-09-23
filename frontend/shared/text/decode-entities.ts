/**
 * Decodes the HTML entities WordPress leaves in plain-text fields.
 *
 * WordPress stores a term name like "API & Integrations" as
 * "API &amp; Integrations" and the REST API returns it that way; wp-admin
 * decodes before display, and so must we. React escapes what it renders, so
 * the decoded string is safe to show as text.
 *
 * No DOM: the client is prerendered in Node, where DOMParser does not exist.
 * Covers numeric entities and the named ones esc_html() and wptexturize()
 * produce; an unknown name is left as it was.
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
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’'
}

const ENTITY = /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi

const fromCodePoint = (code: number, entity: string): string =>
  Number.isInteger(code) && code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : entity

export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value

  return value.replaceAll(ENTITY, (entity, decimal?: string, hex?: string, name?: string) => {
    if (decimal) return fromCodePoint(Number.parseInt(decimal, 10), entity)
    if (hex) return fromCodePoint(Number.parseInt(hex, 16), entity)

    return NAMED[(name ?? '').toLowerCase()] ?? entity
  })
}

/**
 * Plain text out of an HTML fragment: tags dropped, entities decoded, runs of
 * whitespace collapsed. For server messages that arrive as markup, such as
 * WordPress's "There has been a critical error" response.
 */
export function htmlToText(value: string): string {
  return decodeEntities(value.replaceAll(/<[^>]*>/g, ' '))
    .replaceAll(/\s+/g, ' ')
    .trim()
}
