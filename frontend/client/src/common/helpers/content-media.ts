/**
 * The pictures and videos in stored HTML, in the order they appear.
 *
 * A regex rather than the DOM, like plainText: the portal prerenders on the
 * server, where there is no `document` to parse with.
 */

export interface ContentMedia {
  kind: 'image' | 'video'
  src: string
}

const MEDIA = /<(img|video)\b[^>]*?\bsrc=(["'])(.*?)\2/gi

export function contentMedia(html: string): ContentMedia[] {
  return [...html.matchAll(MEDIA)].map(([, tag, , source]) => ({
    kind: tag.toLowerCase() === 'video' ? 'video' : 'image',
    src: source
  }))
}
