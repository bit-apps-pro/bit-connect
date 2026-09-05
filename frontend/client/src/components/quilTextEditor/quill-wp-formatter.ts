/**
 * Quill → WordPress HTML formatter.
 *
 * Converts the raw HTML produced by quill.getSemanticHTML() into clean,
 * semantic HTML that matches what the native WordPress Block Editor (Gutenberg)
 * stores in wp_posts.post_content.
 *
 * Why this matters:
 *  - WordPress themes target wp-block-* classes for typography/spacing.
 *  - wpautop (applied by the_content filter) expects bare <p> tags, not divs.
 *  - SEO plugins read h1/h2/h3 without extra classes.
 *  - Quill emits ql-* classes and ql-indent-N spans that must be stripped.
 *  - Gutenberg wraps headings in wp-block-heading, lists in wp-block-list, etc.
 *
 * Pipeline:
 *   quill.getSemanticHTML()
 *     → parseToDOM()
 *     → walkAndTransform()   ← maps Quill patterns to WP equivalents
 *     → serializeToHtml()
 *     → finalCleanup()       ← regex pass for edge cases DOMParser misses
 */

import { replaceEmojiImages } from './quill-emoji'
import { normalizeQuillLists } from './quill-list-normalizer'

// ---------------------------------------------------------------------------
// Gutenberg block classes
// Gutenberg adds these classes on the frontend; matching them makes theme
// stylesheets apply their typography rules automatically.
// ---------------------------------------------------------------------------
const WP = {
  CODE: 'wp-block-code',
  HEADING: 'wp-block-heading',
  IMAGE: 'wp-block-image',
  LIST: 'wp-block-list',
  LIST_ITEM: '',
  QUOTE: 'wp-block-quote',
  SEPARATOR: 'wp-block-separator',
  TABLE: 'wp-block-table'
} as const

// ---------------------------------------------------------------------------
// Quill-specific class patterns to remove
// ---------------------------------------------------------------------------
const QUILL_CLASS_PATTERN = /\bql-[\w-]+\b/g
const QUILL_INDENT_STYLE = /padding-left\s*:\s*[\d.]+(?:em|px|rem)/gi

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Convert raw Quill HTML to clean WordPress-compatible HTML.
 *
 * This is the single function to call before sending content to the server.
 * It is deterministic, has no side-effects, and does not touch the DOM.
 */
export function formatForWordPress(quillHtml: string): string {
  if (!quillHtml || quillHtml === '<p><br></p>') return ''

  const doc = new DOMParser().parseFromString(quillHtml, 'text/html')

  // Emoji WordPress swapped for sprite images go back to being characters, so
  // the walk below does not wrap a 😀 in a figure and publish it as a photo.
  replaceEmojiImages(doc.body)

  // Quill hands both list kinds over as <ol data-list="…">, and finalCleanup
  // drops that attribute — so the <ul>/<ol> split has to be made here, while
  // the information still exists. See quill-list-normalizer.ts.
  normalizeQuillLists(doc.body)

  walkChildren(doc.body)

  const raw = serializeBody(doc.body)
  return finalCleanup(raw)
}

// ---------------------------------------------------------------------------
// Tree walker — transforms each node in-place, bottom-up
// ---------------------------------------------------------------------------

function walkChildren(parent: Element): void {
  // Collect into array first — we mutate the tree inside
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
    case 'b':
    case 'strong': {
      // Normalise <b> → <strong> (Quill emits <strong>, but pastes from Docs may use <b>)
      if (tag === 'b') renameElement(element, 'strong', parent)
      break
    }
    case 'blockquote': {
      transformBlockquote(element)
      break
    }
    case 'div': {
      flattenDiv(element, parent)
      break
    }
    case 'em':
    case 'i': {
      if (tag === 'i') renameElement(element, 'em', parent)
      break
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      transformHeading(element)
      break
    }
    case 'hr': {
      transformSeparator(element)
      break
    }
    case 'img': {
      transformImage(element, parent)
      break
    }
    case 'li': {
      transformListItem(element)
      break
    }
    case 'ol': {
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
    case 's':
    case 'strike': {
      // Quill uses <s>, WordPress/Gutenberg uses <s> too — just strip ql- classes
      stripQuillClasses(element)
      break
    }
    case 'span': {
      flattenSpan(element, parent)
      break
    }
    case 'ul': {
      transformList(element)
      break
    }
    default: {
      stripQuillClasses(element)
      stripInlineStyle(element)
    }
  }
}

// ---------------------------------------------------------------------------
// Element transformers
// ---------------------------------------------------------------------------

function transformParagraph(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)

  // Quill emits <p><br></p> for empty lines — keep as <p></p> for wpautop
  if (element.innerHTML === '<br>') {
    element.innerHTML = ''
  }

  // Quill centres text with class ql-align-center and a style — convert to WP standard
  // WP stores alignment as has-text-align-* class (Gutenberg) but for simplicity
  // and SEO/theme compatibility we strip alignment and let theme handle it
}

function transformHeading(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)
  // Add Gutenberg's heading class so theme typography rules apply automatically
  element.classList.add(WP.HEADING)
  // Remove empty id attributes Quill may add
  if (!element.id) element.removeAttribute('id')
}

function transformList(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)
  // Gutenberg class makes theme list styles (bullets, numbers, spacing) apply
  element.classList.add(WP.LIST)
}

function transformListItem(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)
}

function transformBlockquote(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)
  element.classList.add(WP.QUOTE)

  // Gutenberg wraps blockquote text in <p> — ensure that structure
  const hasP = [...element.children].some(c => c.tagName.toLowerCase() === 'p')
  if (!hasP && element.textContent?.trim()) {
    const p = element.ownerDocument.createElement('p')
    p.innerHTML = element.innerHTML
    element.innerHTML = ''
    element.append(p)
  }
}

function transformCodeBlock(element: HTMLElement): void {
  stripInlineStyle(element)
  // Quill: <pre data-language="plain">\ncode\n</pre>
  // WordPress/Gutenberg: <pre class="wp-block-code"><code>code</code></pre>
  element.removeAttribute('class')
  element.removeAttribute('spellcheck')
  // The language Quill's syntax module records. wp_kses drops it anyway (<pre>
  // keeps only class and id), so leaving it would only make what we send
  // differ from what gets stored.
  delete element.dataset.language
  element.classList.add(WP.CODE)

  // Wrap content in <code> if not already wrapped
  if (!element.querySelector('code')) {
    const code = element.ownerDocument.createElement('code')
    code.textContent = stripSerialiserPadding(element.textContent || '')
    element.innerHTML = ''
    element.append(code)
  }
}

/**
 * Drop the newline Quill's serialiser puts at each end of a code block.
 *
 * `CodeBlockContainer.html()` emits `<pre>\n…\n</pre>`. Inside a <pre> those
 * are content, so every published snippet would open and close with a blank
 * line. Only one at each end is removed — blank lines the author actually
 * typed are theirs to keep.
 */
function stripSerialiserPadding(code: string): string {
  return code.replace(/^\n/, '').replace(/\n$/, '')
}

/**
 * Promote bare <img> to a Gutenberg-compatible <figure> wrapper.
 * If the img is already inside a <figure>, leave it alone.
 */
function transformImage(element: HTMLElement, parent: Element): void {
  stripInlineStyle(element)
  // Remove editor-only attributes Quill or paste may have added
  delete element.dataset.mceSrc
  delete element.dataset.mceStyle

  // Ensure alt exists (accessibility + SEO)
  if (!element.hasAttribute('alt')) {
    element.setAttribute('alt', '')
  }

  // Already inside a figure — nothing to do
  if (parent.tagName.toLowerCase() === 'figure') return

  // Wrap in <figure class="wp-block-image">
  const figure = element.ownerDocument.createElement('figure')
  figure.className = WP.IMAGE

  const clone = element.cloneNode(true) as HTMLElement
  figure.append(clone)

  element.replaceWith(figure)
}

function transformLink(element: HTMLElement): void {
  stripQuillClasses(element)
  stripInlineStyle(element)

  const href = element.getAttribute('href') || ''
  // External links: force noopener to match WP convention
  if (href.startsWith('http') && !href.includes(window.location.hostname)) {
    element.setAttribute('rel', 'noopener noreferrer')
    element.setAttribute('target', '_blank')
  } else {
    // Internal link — remove unnecessary target/rel
    element.removeAttribute('target')
    element.removeAttribute('rel')
  }
}

function transformSeparator(element: HTMLElement): void {
  stripQuillClasses(element)
  element.className = WP.SEPARATOR
}

// ---------------------------------------------------------------------------
// Span / div flatteners
// ---------------------------------------------------------------------------

/**
 * Quill wraps inline formatting combinations in <span> with classes.
 * If the span has no meaningful attributes after stripping ql- classes,
 * replace it with its children directly.
 */
function flattenSpan(element: HTMLElement, parent: Element): void {
  stripQuillClasses(element)
  stripInlineStyle(element)

  // If the span is now completely bare, unwrap it
  if (!element.hasAttributes()) {
    unwrapElement(element, parent)
  }
}

/**
 * Quill sometimes emits <div> wrappers (e.g. when converting from clipboard).
 * Convert to block-level structure that wpautop understands.
 */
function flattenDiv(element: HTMLElement, parent: Element): void {
  stripQuillClasses(element)
  stripInlineStyle(element)

  if (!element.hasAttributes()) {
    unwrapElement(element, parent)
  }
}

// ---------------------------------------------------------------------------
// DOM utilities
// ---------------------------------------------------------------------------

function stripQuillClasses(element: HTMLElement): void {
  if (!element.hasAttribute('class')) return
  const cleaned = element.className.replaceAll(QUILL_CLASS_PATTERN, '').trim()
  if (cleaned) {
    element.className = cleaned
  } else {
    element.removeAttribute('class')
  }
}

function stripInlineStyle(element: HTMLElement): void {
  element.removeAttribute('style')
}

function unwrapElement(element: Element, parent: Element): void {
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  element.remove()
}

function renameElement(element: HTMLElement, newTag: string, _parent?: Element): void {
  const replacement = element.ownerDocument.createElement(newTag)
  for (const attribute of element.attributes) {
    replacement.setAttribute(attribute.name, attribute.value)
  }
  replacement.innerHTML = element.innerHTML
  element.replaceWith(replacement)
}

// ---------------------------------------------------------------------------
// Serialiser
// ---------------------------------------------------------------------------

function serializeBody(body: Element): string {
  // Collect top-level block HTML, joined by newlines (wpautop-friendly)
  return [...body.childNodes]
    .map(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || '').trim()
        // Bare text at top level — wrap in <p> for wpautop compatibility
        return text ? `<p>${text}</p>` : ''
      }
      return (node as Element).outerHTML || ''
    })
    .filter(Boolean)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Final cleanup — regex pass for things DOMParser normalises away
// ---------------------------------------------------------------------------

function finalCleanup(html: string): string {
  return (
    html
      // Remove any remaining ql- classes that survived serialisation
      .replaceAll(/\s*class="([^"]*)"/g, (_match, classes) => {
        const cleaned = classes.replaceAll(QUILL_CLASS_PATTERN, '').trim()
        return cleaned ? ` class="${cleaned}"` : ''
      })
      // Remove empty class attributes
      .replaceAll(/\s+class=""/g, '')
      // Remove Quill's padding-left indentation styles
      .replaceAll(/\s*style="[^"]*"/g, match => {
        const stripped = match.replaceAll(QUILL_INDENT_STYLE, '').replace(/style="\s*"/, '')
        return stripped === match ? '' : stripped
      })
      // Collapse multiple blank lines into one (wpautop converts double-newline to <p>)
      .replaceAll(/\n{3,}/g, '\n\n')
      // Remove Quill's spellcheck="false" attribute
      .replaceAll(/\s+spellcheck="false"/gi, '')
      // Remove data-list attribute Quill adds to list items
      .replaceAll(/\s+data-list="[^"]*"/gi, '')
      .replaceAll(/&nbsp;/gi, ' ')
      .trim()
  )
}
