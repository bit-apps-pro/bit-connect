/**
 * A video the member uploaded, placed in the text where they put it — the
 * way a picture is, rather than listed under the post.
 *
 * A block of its own: a player mid-sentence would break the sentence in two,
 * and a line to itself is what Gutenberg's video block is. What is saved is
 * the bare `<video src>`; the formatters wrap it in `<figure
 * class="wp-block-video">` as they do a picture, and the portal plays it with
 * the browser's own controls from the site's own uploads, with no third party
 * involved. Registered as 'video-file' so QuillEditor can insert and delete it.
 */

import Quill from 'quill'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BlockEmbedBase = Quill.import('blots/block/embed') as any

class VideoFileBlot extends BlockEmbedBase {
  static blotName = 'video-file'
  static tagName = 'VIDEO'

  static create(value: string): HTMLElement {
    const node = super.create() as HTMLVideoElement
    node.setAttribute('src', value)
    node.setAttribute('controls', '')
    // Enough for the length and the first frame, without downloading the
    // file before anyone presses play.
    node.setAttribute('preload', 'metadata')
    node.setAttribute('playsinline', '')
    node.setAttribute('contenteditable', 'false')
    return node
  }

  static value(node: HTMLElement): string {
    return node.getAttribute('src') ?? ''
  }
}

Quill.register(VideoFileBlot)

/**
 * Take the stored figure off each video before the editor reads the HTML.
 *
 * Quill gives a block embed its own line, and reads a `<figure>` — a block it
 * does not know — as a line too, so a saved video came back with an empty
 * paragraph under it that was not there when it was written. The figure is
 * only the published wrapper (quill-wp-formatter.ts puts it back on save), so
 * nothing is lost by reading the player without it.
 */
export function unwrapVideoFigures(html: string): string {
  return html.replaceAll(/<figure\b[^>]*>\s*(<video\b[^>]*>(?:\s*<\/video>)?)\s*<\/figure>/gi, '$1')
}
