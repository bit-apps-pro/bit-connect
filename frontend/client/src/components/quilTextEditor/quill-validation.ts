/**
 * QuillJS content validation utilities.
 *
 * Frontend validation is a UX layer — it gives instant feedback and reduces
 * bad payloads reaching the server. Backend validation is the final authority.
 */

import { isEmojiImage, replaceEmojiImages } from './quill-emoji'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONTENT_LIMITS = {
  /** Raw HTML character limit must match backend CreateTopicRequest max:10000 */
  MAX_HTML_LENGTH: 10_000,
  /** Plain-text character limit shown to users */
  MAX_HEADINGS: 10,
  MAX_IMAGES: 5,
  MAX_LINKS: 20,
  MAX_NESTING_DEPTH: 10,
  MAX_TABLES: 3,
  MAX_TEXT_LENGTH: 5000
} as const

/**
 * Tags that Quill's snow theme produces.  Anything not in this list is
 * stripped during paste sanitization.
 */
export const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul'
])

/** Attributes allowed per tag. '*' means any allowed tag. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  '*': new Set(['class']),
  a: new Set(['href', 'rel', 'target', 'title']),
  img: new Set(['alt', 'height', 'src', 'title', 'width']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope'])
}

/**
 * Disallowed elements whose *contents* must go with them. Unwrapping a
 * `<script>` would paste its source as visible text; unwrapping a `<select>`
 * would paste every option.
 */
const DROP_WITH_CONTENT = new Set([
  'applet',
  'area',
  'audio',
  'base',
  'button',
  'canvas',
  'embed',
  'form',
  'frame',
  'frameset',
  'head',
  'iframe',
  'input',
  'link',
  'map',
  'math',
  'meta',
  'noscript',
  'object',
  'option',
  'param',
  'script',
  'select',
  'source',
  'style',
  'svg',
  'template',
  'textarea',
  'title',
  'track',
  'video'
])

/**
 * Disallowed elements that occupy their own line. Unwrapping them inline would
 * glue separate lines together, so their content is re-homed in a paragraph.
 */
const BLOCK_CONTAINERS = new Set([
  'address',
  'article',
  'aside',
  'center',
  'dd',
  'details',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'footer',
  'header',
  'main',
  'nav',
  'section',
  'summary'
])

/** Allowed tags that already carry a block of their own. */
const ALLOWED_BLOCKS = new Set([
  'blockquote',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'ol',
  'p',
  'pre',
  'table',
  'ul'
])

/**
 * Structural nodes that hold the content being sanitized. Removing one would
 * take the whole paste with it, so they are left alone once their children have
 * been processed.
 */
const CONTAINER_TAGS = new Set(['body', 'html'])

/** Inline event handler attributes that must always be stripped. */
const DANGEROUS_ATTRS = /^on[a-z]/i

/** URL schemes that are safe to allow. */
const SAFE_URL_SCHEMES = /^(https?|mailto|tel):/i

/** javascript: and data: URIs used in XSS attacks. */
const DANGEROUS_URL = /^(javascript|data|vbscript):/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  errors: string[]
  valid: boolean
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the URL is safe to embed as href or src.
 * Blocks javascript:, data:, and vbscript: URIs.
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase().replaceAll(/\s/g, '')
  if (DANGEROUS_URL.test(trimmed)) return false
  // Relative URLs and protocol-relative URLs are allowed
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('?')) return true
  if (trimmed.startsWith('//')) return true
  return SAFE_URL_SCHEMES.test(trimmed)
}

// ---------------------------------------------------------------------------
// DOM sanitizer (runs on pasted HTML inside Quill clipboard matchers)
// ---------------------------------------------------------------------------

/**
 * Replace a disallowed element with its (already sanitized) children.
 *
 * Collapsing the element to `textContent` instead — the obvious shortcut —
 * destroys everything nested inside it: a `<div>` wrapping a paragraph and a
 * screenshot becomes a bare line of text, and a `<div>` wrapping only an image
 * becomes nothing at all. Since browsers wrap copied content in `<div>`s, that
 * shortcut loses most real-world pastes.
 */
function unwrapElement(element: Element): void {
  const parent = element.parentNode
  if (!parent) return

  const tag = element.tagName.toLowerCase()

  if (DROP_WITH_CONTENT.has(tag) || !element.hasChildNodes()) {
    element.remove()
    return
  }

  // A block container whose children are all inline needs a paragraph of its
  // own, or its line runs into the one before it.
  const hasBlockChild = [...element.children].some(child =>
    ALLOWED_BLOCKS.has(child.tagName.toLowerCase())
  )

  if (BLOCK_CONTAINERS.has(tag) && !hasBlockChild) {
    const paragraph = element.ownerDocument.createElement('p')
    while (element.firstChild) paragraph.append(element.firstChild)
    element.replaceWith(paragraph)
    return
  }

  while (element.firstChild) parent.insertBefore(element.firstChild, element)
  element.remove()
}

/**
 * Recursively sanitize a DOM node in-place.
 *
 * - Unwraps disallowed elements (retaining the content nested inside them).
 * - Strips dangerous attributes and unsafe URLs.
 * - Prevents deeply nested structures that could abuse rendering.
 */
export function sanitizeNode(node: Node, depth = 0): void {
  if (depth > CONTENT_LIMITS.MAX_NESTING_DEPTH) {
    node.parentNode?.removeChild(node)
    return
  }

  // Process children first (bottom-up so removal doesn't skip siblings)
  const children = [...node.childNodes]
  for (const child of children) {
    sanitizeNode(child, depth + 1)
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return

  const element = node as Element
  const tag = element.tagName.toLowerCase()

  // `<body>` is the container the caller handed us, not pasted markup. Removing
  // it would leave `doc.body` null and take the entire paste with it.
  if (CONTAINER_TAGS.has(tag)) return

  if (!ALLOWED_TAGS.has(tag)) {
    unwrapElement(element)
    return
  }

  // Strip attributes
  const attributesToRemove: string[] = []
  for (const attribute of element.attributes) {
    const name = attribute.name.toLowerCase()
    const tagAllowed = ALLOWED_ATTRIBUTES[tag]
    const globalAllowed = ALLOWED_ATTRIBUTES['*']
    const isAllowed = tagAllowed?.has(name) || globalAllowed?.has(name)

    if (!isAllowed || DANGEROUS_ATTRS.test(name)) {
      attributesToRemove.push(attribute.name)
      continue
    }

    // Validate URL values on href / src / action
    if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) {
      attributesToRemove.push(attribute.name)
    }
  }
  for (const attribute of attributesToRemove) {
    element.removeAttribute(attribute)
  }

  // Remove img elements whose src was stripped — a srcless img is broken and
  // likely had a data: URI that isSafeUrl rejected above.
  if (tag === 'img' && !element.getAttribute('src')) {
    node.parentNode?.removeChild(node)
    return
  }

  // Force external links to open safely
  if (tag === 'a') {
    const href = element.getAttribute('href') || ''
    if (href.startsWith('http')) {
      element.setAttribute('rel', 'noopener noreferrer')
      element.setAttribute('target', '_blank')
    }
  }

  // Remove Word/Google Docs tracking classes like MsoNormal, kix-*, etc.
  if (element.hasAttribute('class')) {
    const cleaned = [...element.classList].filter(c => !/^(Mso|kix-|docs-|apple-|x_)/i.test(c)).join(' ')
    if (cleaned) {
      element.setAttribute('class', cleaned)
    } else {
      element.removeAttribute('class')
    }
  }

  // Remove all inline styles (Word/Docs produce massive style dumps)
  element.removeAttribute('style')
  delete (element as HTMLElement).dataset.mceStyle
  delete (element as HTMLElement).dataset.mceHref

  // Remove hidden elements used for tracking
  const computedDisplay = (element as HTMLElement).style?.display
  if (computedDisplay === 'none') {
    node.parentNode?.removeChild(node)
  }
}

/**
 * Sanitize a raw HTML string by parsing it through the DOM sanitizer.
 * Returns cleaned HTML safe for insertion into Quill.
 */
export function sanitizeHtml(html: string): string {
  // Use DOMParser to avoid innerHTML XSS on the actual document
  const parser = new DOMParser()
  const doc = parser.parseFromString(html ?? '', 'text/html')

  // Emoji sprites become characters again before anything else looks at them.
  // On paste this stores what the author sees; on render it repairs comments
  // saved before the formatters learned to do it, whose emoji would otherwise
  // stay 200px-wide images. See quill-emoji.ts.
  replaceEmojiImages(doc.body)

  // Iterate a copy: `childNodes` is live, and sanitizeNode removes and unwraps
  // nodes as it goes, which would make a live list skip siblings.
  for (const child of doc.body.childNodes) {
    sanitizeNode(child)
  }

  return doc.body.innerHTML
}

// ---------------------------------------------------------------------------
// Content validators
// ---------------------------------------------------------------------------

/**
 * Strip all HTML tags and decode entities to get plain text.
 * Used for character-count validation (user sees text length, not markup).
 */
function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

/**
 * Validate the HTML content coming from Quill before submission.
 * Returns all errors so the UI can show them simultaneously.
 */
export function validateContent(html: string): ValidationResult {
  const errors: string[] = []

  if (!html || html === '<p><br></p>' || html.trim() === '') {
    errors.push('Content cannot be empty.')
    return { errors, valid: false }
  }

  // Raw HTML size check (matches backend max:10000)
  if (html.length > CONTENT_LIMITS.MAX_HTML_LENGTH) {
    errors.push(
      `Content is too long (${html.length.toLocaleString()} chars). Maximum is ${CONTENT_LIMITS.MAX_HTML_LENGTH.toLocaleString()} characters.`
    )
  }

  // Human-readable text check
  const plain = htmlToPlainText(html)
  if (plain.length > CONTENT_LIMITS.MAX_TEXT_LENGTH) {
    errors.push(
      `Content exceeds ${CONTENT_LIMITS.MAX_TEXT_LENGTH.toLocaleString()} characters. Please shorten it.`
    )
  }

  // Parse and count elements
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Emoji sprites are characters, not pictures — counting them meant six 😀
  // failed a draft holding no images at all.
  const imageCount = [...doc.querySelectorAll('img')].filter(img => !isEmojiImage(img)).length
  if (imageCount > CONTENT_LIMITS.MAX_IMAGES) {
    errors.push(`Too many images (${imageCount}). Maximum is ${CONTENT_LIMITS.MAX_IMAGES}.`)
  }

  const linkCount = doc.querySelectorAll('a').length
  if (linkCount > CONTENT_LIMITS.MAX_LINKS) {
    errors.push(`Too many links (${linkCount}). Maximum is ${CONTENT_LIMITS.MAX_LINKS}.`)
  }

  const tableCount = doc.querySelectorAll('table').length
  if (tableCount > CONTENT_LIMITS.MAX_TABLES) {
    errors.push(`Too many tables (${tableCount}). Maximum is ${CONTENT_LIMITS.MAX_TABLES}.`)
  }

  const headingCount = doc.querySelectorAll('h1,h2,h3,h4,h5,h6').length
  if (headingCount > CONTENT_LIMITS.MAX_HEADINGS) {
    errors.push(`Too many headings (${headingCount}). Maximum is ${CONTENT_LIMITS.MAX_HEADINGS}.`)
  }

  // Detect dangerous patterns that should have been sanitized already.
  //
  // The event-handler pattern has to start at an attribute boundary. Unanchored,
  // `on\w+=` also matches the tail of ordinary attribute names — `contenteditable=`
  // contains `ontenteditable=` — which rejected any draft holding the upload
  // placeholder (it carries contenteditable="false") with a bogus "disallowed
  // code" error, losing the image the author was waiting on.
  const dangerousPatterns = [/<script/i, /javascript:/i, /<iframe/i, /[\s"'/]on[a-z]+\s*=/i]
  for (const pattern of dangerousPatterns) {
    if (pattern.test(html)) {
      errors.push('Content contains disallowed code and cannot be submitted.')
      break
    }
  }

  // Validate all href / src URLs
  const links = doc.querySelectorAll('a[href], img[src]')
  for (const element of links) {
    const url = element.getAttribute('href') || element.getAttribute('src') || ''
    if (url && !isSafeUrl(url)) {
      errors.push(
        `Unsafe URL detected: "${url.slice(0, 80)}". Only http, https, mailto, and tel links are allowed.`
      )
      break
    }
  }

  // Catch base64-embedded images that bypassed sanitization (e.g. programmatic insertion)
  for (const img of doc.querySelectorAll('img')) {
    if (/^data:/i.test(img.getAttribute('src') || '')) {
      errors.push(
        'Embedded base64 images are not allowed. Please upload images using the attachment button.'
      )
      break
    }
  }

  return { errors, valid: errors.length === 0 }
}

// ---------------------------------------------------------------------------
// Word / Google Docs paste cleaner
// ---------------------------------------------------------------------------

/**
 * Strip Microsoft Word and Google Docs cruft from an HTML string.
 * Called before the result is handed to Quill's clipboard.
 *
 * Word wraps everything in <w:…> / MsoNormal style soup.
 * Google Docs uses kix-* classes and nested <span> with explicit font sizes.
 */
export function cleanPastedHtml(html: string): string {
  let cleaned = html

  // Remove Word XML namespaced tags
  cleaned = cleaned.replaceAll(/<\/?w:[^>]*>/gi, '')
  cleaned = cleaned.replaceAll(/<\/?o:[^>]*>/gi, '')
  cleaned = cleaned.replaceAll(/<\/?m:[^>]*>/gi, '')

  // Remove Word conditional comments
  cleaned = cleaned.replaceAll(/<!--\[if[^>]*>[\s\S]*?<!\[endif\]-->/gi, '')

  // Remove all style attributes (Word / Docs inline styles are noisy and unsafe)
  cleaned = cleaned.replaceAll(/\s+style="[^"]*"/gi, '')
  cleaned = cleaned.replaceAll(/\s+style='[^']*'/gi, '')

  // Remove all class attributes that look Word/Docs-specific
  cleaned = cleaned.replaceAll(/\s+class="(Mso|kix-|docs-|apple-|x_)[^"]*"/gi, '')

  // Remove empty tags left behind
  cleaned = cleaned.replaceAll(/<(span|div|p)[^>]*>\s*<\/\1>/gi, '')

  // Collapse multiple <br> into one
  cleaned = cleaned.replaceAll(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')

  return cleaned
}
