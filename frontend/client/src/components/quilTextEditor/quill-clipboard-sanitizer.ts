/**
 * Quill clipboard sanitizer module.
 *
 * Registers as a Quill module so it intercepts paste events before Quill
 * converts pasted HTML into its Delta format.  This is the only reliable
 * hook point: DOM mutations after insert are too late to prevent XSS because
 * the browser may already have rendered hidden scripts.
 *
 * Quill module lifecycle:
 *   new Quill(el, { modules: { clipboardSanitizer: true } })
 *   → Quill calls new ClipboardSanitizerModule(quill, options)
 */

import Quill, { type Delta } from 'quill'

import {
  ALLOWED_TAGS,
  cleanPastedHtml,
  CONTENT_LIMITS,
  isSafeUrl,
  sanitizeHtml
} from './quill-validation'

const DeltaCtor = Quill.import('delta') as new (ops?: unknown[]) => Delta

/** Tags whose contents must be dropped rather than kept when the tag is not allowed. */
const DROP_CONTENT_TAGS = new Set(['head', 'iframe', 'noscript', 'script', 'style', 'template'])

/** The image file on the clipboard, if there is one. */
function getClipboardImage(data: DataTransfer): File | undefined {
  const item = [...(data.items ?? [])].find(i => i.kind === 'file' && i.type.startsWith('image/'))
  return item?.getAsFile() ?? undefined
}

/**
 * True when the clipboard HTML is nothing but the wrapper around a copied
 * picture — what Chrome, Word and Google Docs put beside the image file itself.
 *
 * That wrapper usually points at a source the editor cannot keep (`file://`,
 * `blob:`, base64), so the file has to be uploaded instead. Content with text
 * in it is a real HTML paste and must not be replaced by a lone image.
 */
function isImageOnlyPaste(html: string): boolean {
  if (!html.trim()) return true

  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (doc.body.textContent?.trim()) return false

  return doc.body.querySelectorAll('img').length <= 1
}

// ---------------------------------------------------------------------------
// Quill module registration
// ---------------------------------------------------------------------------

class ClipboardSanitizerModule {
  private quill: Quill

  constructor(quill: Quill) {
    this.quill = quill
    this.registerMatchers()
    this.interceptPaste()
  }

  // -------------------------------------------------------------------------
  // Clipboard matchers
  //
  // Quill processes pasted HTML top-down, applying matchers to each DOM node.
  // We register a wildcard matcher ('*') that runs on every element and strips
  // anything that isn't in our whitelist before Quill converts it to Delta.
  // -------------------------------------------------------------------------

  /** Insert plain text at the caret, replacing any selection. */
  private insertPlainText(text: string): void {
    const range = this.quill.getSelection(true)
    this.quill.updateContents(
      new DeltaCtor().retain(range.index).delete(range.length).insert(text),
      'user'
    )
    this.quill.setSelection(range.index + text.length, 0, 'user')
  }

  private interceptPaste(): void {
    this.quill.root.addEventListener(
      'paste',
      (e: ClipboardEvent) => {
        const clipboardData = e.clipboardData
        if (!clipboardData) return

        const html = clipboardData.getData('text/html')

        // Upload a copied image rather than letting Quill embed it as a base64
        // data URI, which inflates the payload and bypasses validation. The file
        // is preferred over any HTML wrapper the source pasted alongside it —
        // that wrapper points at a local or base64 source that gets stripped,
        // which is why an image copied from an app used to paste as nothing.
        const imageFile = getClipboardImage(clipboardData)
        if (imageFile && isImageOnlyPaste(html)) {
          e.preventDefault()
          e.stopPropagation()
          this.quill.root.dispatchEvent(
            new CustomEvent('quill-image-paste', { bubbles: true, detail: { file: imageFile } })
          )
          return
        }

        if (!html) return // plain text paste — let Quill handle it normally

        // Prevent Quill's default paste handling
        e.preventDefault()
        e.stopPropagation()

        // Steps 1 & 2: strip Word/Docs markup patterns, then sanitize the DOM
        let sanitizedHtml: string
        try {
          sanitizedHtml = sanitizeHtml(cleanPastedHtml(html))
        } catch (error) {
          // The default is already prevented, so a failure here would drop the
          // paste on the floor. Fall back to the plain-text flavour instead.
          console.error('Paste sanitization failed:', error)
          const text = clipboardData.getData('text/plain')
          if (text) this.insertPlainText(text)
          return
        }

        // Step 3: Enforce size limit on paste to prevent clipboard-bomb attacks
        if (sanitizedHtml.length > CONTENT_LIMITS.MAX_HTML_LENGTH) {
          // Truncate and notify user via Quill's root element custom event
          this.quill.root.dispatchEvent(
            new CustomEvent('quill-paste-rejected', {
              bubbles: true,
              detail: { reason: 'Content from clipboard exceeds the maximum allowed length.' }
            })
          )
          return
        }

        // Step 4: Let Quill convert the sanitized HTML into Delta format
        const range = this.quill.getSelection(true)
        const delta = this.quill.clipboard.convert({ html: sanitizedHtml })

        this.quill.updateContents(
          // Delete selected text, then insert pasted content
          new DeltaCtor().retain(range.index).delete(range.length).concat(delta),
          'user'
        )

        this.quill.setSelection(range.index + delta.length(), 0, 'user')
      },
      // Use capture phase so our handler runs before Quill's own paste handler
      true
    )
  }

  // -------------------------------------------------------------------------
  // Paste interception
  //
  // We listen to the paste event on the editor root before Quill processes it.
  // This gives us the raw clipboard HTML which we clean (Word/Docs stripping)
  // before handing to Quill's own clipboard handling.
  // -------------------------------------------------------------------------

  private registerMatchers(): void {
    // Node.ELEMENT_NODE = 1
    this.quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      const element = node as Element
      const tag = element.tagName?.toLowerCase()

      // Unwrap disallowed elements: `delta` is what the children already
      // converted to, so returning it keeps their text, formatting and images
      // while the wrapper itself disappears. Tags whose content is not meant to
      // be read (script source, styles) are dropped whole.
      if (tag && !ALLOWED_TAGS.has(tag)) {
        return DROP_CONTENT_TAGS.has(tag) ? new DeltaCtor([]) : delta
      }

      // Strip dangerous attributes from allowed elements
      if (element instanceof Element) {
        const attributesToRemove: string[] = []

        for (const attribute of element.attributes) {
          const name = attribute.name.toLowerCase()

          // Block all event handlers
          if (/^on[a-z]/i.test(name)) {
            attributesToRemove.push(attribute.name)
            continue
          }

          // Validate href / src
          if ((name === 'href' || name === 'src') && !isSafeUrl(attribute.value)) {
            attributesToRemove.push(attribute.name)
          }

          // Strip style — Word / Docs inject enormous inline CSS
          if (name === 'style') {
            attributesToRemove.push(attribute.name)
          }
        }

        for (const attribute of attributesToRemove) {
          try {
            element.removeAttribute(attribute)
          } catch {
            // Read-only attribute in some browsers — safe to ignore
          }
        }
      }

      return delta
    })

    // Matcher for text nodes — no action needed, just pass through
    this.quill.clipboard.addMatcher(Node.TEXT_NODE, (_node, delta) => delta)
  }
}

// Register the module with Quill so it can be declared in the modules config
Quill.register('modules/clipboardSanitizer', ClipboardSanitizerModule)
