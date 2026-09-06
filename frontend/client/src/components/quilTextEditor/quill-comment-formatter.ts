/**
 * Quill → WordPress comment HTML formatter.
 *
 * Narrower than quill-wp-formatter.ts because comment content has stricter
 * constraints than post content:
 *
 *  - WordPress's comment_text filter applies wpautop, convert_smilies, and
 *    convert_chars — content must be paragraph-based, not block-based.
 *  - WordPress's default allowed comment tags are minimal: a, strong, em,
 *    code, blockquote, ul, ol, li, del, b, i, q, s. We extend this slightly
 *    for pre/code blocks and links.
 *  - No Gutenberg block classes (wp-block-*) — comments are not blocks.
 *  - No headings — comments are prose, not documents.
 *  - Images are allowed (uploaded to WP media library, https:// src only).
 *  - No tables — not part of WordPress's comment allowed tag set.
 *  - Inline styles are always removed.
 *  - All ql-* Quill artefacts must be stripped before storage.
 *
 * Pipeline:
 *   quill.getSemanticHTML()
 *     → parseToDOM()
 *     → walkAndTransform()
 *     → serializeToHtml()
 *     → finalCleanup()
 */

import { MENTION_CLASS } from './mention-markup'
import { replaceEmojiImages } from './quill-emoji'
import { normalizeQuillLists } from './quill-list-normalizer'

// ---------------------------------------------------------------------------
// Limits — mirrored in CommentSanitizerService.php
// ---------------------------------------------------------------------------
export const COMMENT_LIMITS = {
  /** MySQL comment_content column is TEXT = 65,535 bytes */
  MAX_HTML_BYTES: 65_000,
  MAX_LINKS: 5,
  MAX_NESTING_DEPTH: 8,
  MAX_TEXT_CHARS: 5000
} as const

// ---------------------------------------------------------------------------
// Allowed tag set for comments
// Mirrors CommentSanitizerService::getAllowedHtml()
// ---------------------------------------------------------------------------
const COMMENT_ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'strong',
  'u',
  'ul'
])

const QUILL_CLASS_PATTERN = /\bql-[\w-]+\b/g

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Convert raw Quill HTML to clean WordPress comment-compatible HTML.
 * Call this before every comment create/update API call.
 */
export function formatCommentForWordPress(quillHtml: string): string {
  if (!quillHtml || quillHtml === '<p><br></p>') return ''

  const doc = new DOMParser().parseFromString(quillHtml, 'text/html')

  // Before anything else: WordPress's emoji script may have replaced characters
  // the author typed with sprite images. Put the characters back, or the walk
  // below strips the class that keeps them emoji-sized and stores a 😀 that
  // renders as a 200px photo. See quill-emoji.ts.
  replaceEmojiImages(doc.body)

  // Both list kinds reach us as <ol data-list="…">, and finalCleanup drops
  // that attribute — so the <ul>/<ol> split has to be made while the
  // information still exists. See quill-list-normalizer.ts.
  normalizeQuillLists(doc.body)

  walkChildren(doc.body)

  const raw = serializeBody(doc.body)
  return finalCleanup(raw)
}

/**
 * Quick character-count check for the comment editor UI.
 * Returns number of plain-text characters (not HTML length).
 */
export function getCommentPlainTextLength(quillHtml: string): number {
  const tmp = document.createElement('div')
  tmp.innerHTML = quillHtml
  return (tmp.textContent || '').length
}

// ---------------------------------------------------------------------------
// Tree walker
// ---------------------------------------------------------------------------

function walkChildren(parent: Element): void {
  for (const child of parent.children) {
    walkChildren(child)
    transformElement(child as HTMLElement, parent)
  }
}

function transformElement(element: HTMLElement, parent: Element): void {
  const tag = element.tagName.toLowerCase()

  switch (tag) {
    case 'a': {
      transformLink(element)
      break
    }
    case 'b': {
      renameElement(element, 'strong', parent)
      break
    }
    case 'blockquote': {
      transformBlockquote(element)
      break
    }
    case 'code':
    case 'del':
    case 'em':
    case 'q':
    case 's':
    case 'strong':
    case 'u': {
      stripQuillAttributes(element)
      break
    }
    // Discard structural elements not allowed in comments
    case 'div':
    case 'figure': {
      unwrapElement(element, parent)
      break
    }
    // Headings → demote to bold paragraph — comments are prose, not documents
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      demoteHeading(element, parent)
      break
    }
    case 'hr':
    case 'table':
    case 'tbody':
    case 'td':
    case 'th':
    case 'thead':
    case 'tr': {
      unwrapElement(element, parent)
      break
    }
    case 'i': {
      renameElement(element, 'em', parent)
      break
    }
    case 'img': {
      transformImage(element, parent)
      break
    }
    case 'li': {
      stripQuillAttributes(element)
      break
    }
    case 'ol':
    case 'ul': {
      transformList(element)
      break
    }
    case 'p': {
      transformParagraph(element)
      break
    }
    case 'pre': {
      transformCodeBlock(element)
      break
    }
    case 'span': {
      flattenSpan(element, parent)
      break
    }
    default: {
      if (COMMENT_ALLOWED_TAGS.has(tag)) {
        stripQuillAttributes(element)
      } else {
        unwrapElement(element, parent)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Element transformers
// ---------------------------------------------------------------------------

function transformParagraph(element: HTMLElement): void {
  stripQuillAttributes(element)
  // Quill empty paragraph — keep as empty <p> for wpautop
  if (element.innerHTML === '<br>') {
    element.innerHTML = ''
  }
}

/**
 * Demote headings to bold text wrapped in <p>.
 * WordPress comment allowed tags don't include headings; storing them
 * would cause wp_kses to strip the tags but keep the text — ugly.
 * Converting to bold preserves the author's intent while staying compatible.
 */
function demoteHeading(element: HTMLElement, _parent: Element): void {
  const p = element.ownerDocument.createElement('p')
  const strong = element.ownerDocument.createElement('strong')
  strong.innerHTML = element.innerHTML
  p.append(strong)
  element.replaceWith(p)
}

function transformBlockquote(element: HTMLElement): void {
  stripQuillAttributes(element)
  // Ensure text content is wrapped in <p> — wpautop expects it
  const hasP = [...element.children].some(c => c.tagName.toLowerCase() === 'p')
  if (!hasP && element.textContent?.trim()) {
    const p = element.ownerDocument.createElement('p')
    p.innerHTML = element.innerHTML
    element.innerHTML = ''
    element.append(p)
  }
}

function transformCodeBlock(element: HTMLElement): void {
  // Quill: <pre data-language="plain">\ncode\n</pre>
  // WordPress comment: <pre><code>code</code></pre>
  element.removeAttribute('class')
  element.removeAttribute('style')
  element.removeAttribute('spellcheck')
  delete element.dataset.language

  if (!element.querySelector('code')) {
    const code = element.ownerDocument.createElement('code')
    // Quill's serialiser pads the source with a newline at each end, and a
    // <pre> keeps them — every snippet would open and close with a blank line.
    code.textContent = (element.textContent || '').replace(/^\n/, '').replace(/\n$/, '')
    element.innerHTML = ''
    element.append(code)
  }
}

function transformList(element: HTMLElement): void {
  stripQuillAttributes(element)
}

function transformLink(element: HTMLElement): void {
  stripQuillAttributes(element)

  const href = element.getAttribute('href') || ''

  // Remove dangerous URLs
  if (/^(javascript|data|vbscript):/i.test(href.trim())) {
    // Replace the entire <a> with its text content
    const text = element.ownerDocument.createTextNode(element.textContent || '')
    element.parentNode?.replaceChild(text, element)
    return
  }

  // Keep only href, title — and, on a mention, the class that makes it look
  // like one. CommentSanitizerService admits that single class value on a link
  // for the same reason; stripping it here would mean a mention in a comment
  // arrived as an ordinary blue link while the same mention in a topic kept its
  // styling.
  const hrefVal = element.getAttribute('href') || ''
  const titleVal = element.getAttribute('title') || ''
  const isMention = element.classList.contains(MENTION_CLASS)
  ;[...element.attributes].forEach(a => element.removeAttribute(a.name))
  if (hrefVal) element.setAttribute('href', hrefVal)
  if (titleVal) element.setAttribute('title', titleVal)
  if (isMention) element.setAttribute('class', MENTION_CLASS)

  // External links: add rel="nofollow ugc" (WordPress convention for comment links)
  if (hrefVal.startsWith('http')) {
    element.setAttribute('rel', 'nofollow ugc')
  }
}

// ---------------------------------------------------------------------------
// DOM utilities
// ---------------------------------------------------------------------------

function stripQuillAttributes(element: HTMLElement): void {
  element.removeAttribute('style')
  delete element.dataset.list
  delete element.dataset.mceStyle

  if (element.hasAttribute('class')) {
    const cleaned = element.className.replaceAll(QUILL_CLASS_PATTERN, '').trim()
    if (cleaned) {
      element.className = cleaned
    } else {
      element.removeAttribute('class')
    }
  }
}

function flattenSpan(element: HTMLElement, parent: Element): void {
  stripQuillAttributes(element)
  if (!element.hasAttributes()) {
    unwrapElement(element, parent)
  }
}

function transformImage(element: HTMLElement, _parent: Element): void {
  const source = element.getAttribute('src') || ''
  const alt = element.getAttribute('alt') || ''
  // Only keep https/http images — strip data: URIs and anything unsafe
  if (!/^https?:\/\//i.test(source)) {
    element.remove()
    return
  }
  ;[...element.attributes].forEach(a => element.removeAttribute(a.name))
  element.setAttribute('src', source)
  if (alt) element.setAttribute('alt', alt)
}

function unwrapElement(element: Element, parent: Element): void {
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  element.remove()
}

function renameElement(element: HTMLElement, newTag: string, _parent: Element): void {
  const replacement = element.ownerDocument.createElement(newTag)
  replacement.innerHTML = element.innerHTML
  element.replaceWith(replacement)
}

// ---------------------------------------------------------------------------
// Serialiser — newline-separated blocks for wpautop compatibility
// ---------------------------------------------------------------------------

function serializeBody(body: Element): string {
  return [...body.childNodes]
    .map(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim()
        return text ? `<p>${text}</p>` : ''
      }
      return (node as Element).outerHTML || ''
    })
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Final regex cleanup
// ---------------------------------------------------------------------------

function finalCleanup(html: string): string {
  return (
    html
      // Strip any residual ql- classes
      .replaceAll(/\s*class="([^"]*)"/g, (_m, classes) => {
        const cleaned = classes.replaceAll(QUILL_CLASS_PATTERN, '').trim()
        return cleaned ? ` class="${cleaned}"` : ''
      })
      .replaceAll(/\s+class=""/g, '')
      // Remove all inline styles
      .replaceAll(/\s+style="[^"]*"/g, '')
      // Remove spellcheck attribute
      .replaceAll(/\s+spellcheck="false"/gi, '')
      // Remove data-list attribute
      .replaceAll(/\s+data-list="[^"]*"/gi, '')
      // Collapse blank lines
      .replaceAll(/\n{3,}/g, '\n\n')
      .replaceAll(/&nbsp;/gi, ' ')
      .trim()
  )
}
