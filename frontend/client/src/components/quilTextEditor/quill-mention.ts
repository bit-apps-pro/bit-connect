/**
 * The "@" picker.
 *
 * Typing "@" opens a list of members; picking one writes a link to their
 * profile, with their name as the text. That link *is* the mention — the server
 * reads it back out of the stored words (MentionService) rather than trusting a
 * list of ids from here, so nothing in this file decides who gets notified. It
 * decides what the author sees while they type.
 *
 * Two Quill pieces, registered together:
 *
 *   - a `mention` inline blot, so the anchor carries a class and can be styled
 *     as a chip instead of looking like any other blue link.
 *   - a `mention` module, which owns the dropdown, the keyboard and the search.
 *
 * Quill module lifecycle:
 *   new Quill(el, { modules: { mention: { search } } })
 *   → Quill calls new MentionModule(quill, { search })
 */

import Quill from 'quill'

import { MENTION_CLASS } from './mention-markup'
import { type MentionCandidate } from './mention-source'
import styles from './quill-mention.module.css'

/** How long typing settles before the list is asked. */
const SEARCH_DEBOUNCE_MS = 160

/** Space kept between the caret and the list, and between the list and the viewport edge. */
const GUTTER_PX = 6

/**
 * Longest run of characters read as a query.
 *
 * Beyond this the "@" was almost certainly punctuation in a sentence rather
 * than a name being typed, and the picker should get out of the way.
 */
const MAX_TERM_LENGTH = 30

// ---------------------------------------------------------------------------
// Where the caret is
// ---------------------------------------------------------------------------

export interface MentionQuery {
  /** Document index of the "@" itself. */
  index: number
  /** How much to replace when a name is picked: the "@" plus what follows. */
  length: number
  /** What has been typed after the "@". */
  term: string
}

/**
 * An "@" only opens a mention at the start of a word.
 *
 * Without the leading boundary every email address in a draft would open the
 * picker on the character after the local part. Spaces are not part of a term
 * on purpose: the search matches anywhere in a display name, so "@carter" finds
 * Aiden Carter without the picker having to guess where a name ends.
 */
const TRIGGER = new RegExp(String.raw`(?:^|[\s([{"'])@([\p{L}\p{N}._-]{0,${MAX_TERM_LENGTH}})$`, 'u')

/**
 * The mention being typed at the end of this text, if there is one.
 *
 * Pure, and exported for that reason: the trigger rule is the part of this
 * module worth testing, and it needs neither Quill nor a DOM to state.
 */
export function findMentionQuery(textBeforeCaret: string): MentionQuery | undefined {
  const match = TRIGGER.exec(textBeforeCaret)

  if (!match) return undefined

  const term = match[1]
  const length = term.length + 1

  return { index: textBeforeCaret.length - length, length, term }
}

/**
 * Document text up to the caret, with embeds counted.
 *
 * `quill.getText()` drops embeds entirely, so an image earlier in the comment
 * would shift every index after it and the picker would replace the wrong
 * characters. Each embed stands in as one replacement character, which keeps
 * the string aligned with the document and cannot itself match the trigger.
 */
function textBeforeCaret(quill: Quill, caretIndex: number): string {
  return quill
    .getContents(0, caretIndex)
    .ops.map(op => (typeof op.insert === 'string' ? op.insert : '\uFFFD'))
    .join('')
}

// ---------------------------------------------------------------------------
// The blot
// ---------------------------------------------------------------------------

interface MentionValue {
  href: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const InlineBase = Quill.import('blots/inline') as any

class MentionBlot extends InlineBase {
  static blotName = 'mention'
  static className = MENTION_CLASS
  static tagName = 'A'

  static create(value: MentionValue): HTMLElement {
    const node = super.create(value) as HTMLAnchorElement
    node.setAttribute('href', value?.href ?? '')
    return node
  }

  /**
   * What the editor reads back off a stored mention.
   *
   * Only the href, because only the href survives everywhere: it is what the
   * server parses the mention out of, and the one thing every sanitizer between
   * here and the database agrees to keep.
   */
  static formats(node: HTMLElement): MentionValue {
    return { href: node.getAttribute('href') ?? '' }
  }
}

Quill.register(MentionBlot)

// Put the plain link back on top of the `A` tag.
//
// Parchment indexes a blot by class *and* by tag, so registering an anchor blot
// above claimed every `<a>` in the registry — and an ordinary pasted link would
// have come back as a mention. Re-registering Link restores the tag lookup
// while the class lookup, which Parchment consults first, stays with the
// mention. Order matters: this has to run after the line above.
Quill.register(Quill.import('formats/link') as never, true)

// ---------------------------------------------------------------------------
// The module
// ---------------------------------------------------------------------------

interface MentionModuleOptions {
  search: (term: string, signal?: AbortSignal) => Promise<MentionCandidate[]>
}

/** Ids have to be unique across editors: a page can hold several at once. */
let instances = 0

class MentionModule {
  private activeIndex = 0

  private candidates: MentionCandidate[] = []

  private controller?: AbortController

  private debounce?: ReturnType<typeof setTimeout>

  private options: MentionModuleOptions

  private query?: MentionQuery

  private quill: Quill

  /**
   * Guards against an earlier search resolving after a later one. Aborting the
   * request is not enough on its own — a response already in flight can still
   * land, and it would repopulate the list with results for text the author has
   * since changed.
   */
  private requestId = 0

  private readonly root: HTMLDivElement

  constructor(quill: Quill, options: MentionModuleOptions) {
    this.quill = quill
    this.options = options

    this.root = document.createElement('div')
    this.root.className = styles.list
    this.root.id = `bc-mention-list-${++instances}`
    this.root.setAttribute('role', 'listbox')
    this.root.hidden = true

    // On the body rather than beside the editor: the editor wrapper clips its
    // overflow to keep the rounded corners, which would cut the list off at the
    // bottom edge of a one-line comment box.
    document.body.append(this.root)

    quill.root.setAttribute('aria-autocomplete', 'list')
    quill.root.setAttribute('aria-controls', this.root.id)
    quill.root.setAttribute('aria-expanded', 'false')

    quill.on('text-change', this.handleTextChange)
    quill.on('selection-change', this.handleSelectionChange)

    // On the container, capturing, so it runs before the editor's own key
    // handling. Bound to `quill.root` it would be a listener on the focused
    // element itself, where order is decided by which module registered first —
    // and Quill's keyboard module always registers before this one, so Enter
    // would break the line before the picker ever saw it.
    quill.container.addEventListener('keydown', this.handleKeyDown, true)

    this.root.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('resize', this.close)
    // Capturing, so a scroll inside any ancestor is caught, not just the page.
    window.addEventListener('scroll', this.reposition, true)
  }

  /**
   * Called by QuillEditor when the editor unmounts.
   *
   * Quill has no teardown of its own, and the list lives on `document.body` —
   * without this, every remount of a comment box would leave one behind.
   */
  destroy = (): void => {
    this.controller?.abort()
    clearTimeout(this.debounce)

    this.quill.off('text-change', this.handleTextChange)
    this.quill.off('selection-change', this.handleSelectionChange)
    this.quill.container.removeEventListener('keydown', this.handleKeyDown, true)
    window.removeEventListener('resize', this.close)
    window.removeEventListener('scroll', this.reposition, true)

    this.root.remove()
  }

  private close = (): void => {
    this.controller?.abort()
    clearTimeout(this.debounce)

    this.query = undefined
    this.candidates = []
    this.activeIndex = 0

    if (!this.root.hidden) {
      this.root.hidden = true
      this.root.replaceChildren()
    }

    this.quill.root.setAttribute('aria-expanded', 'false')
    this.quill.root.removeAttribute('aria-activedescendant')
  }

  /**
   * Decide whether the caret is in a mention, and ask if it is.
   */
  private detect = (): void => {
    const range = this.quill.getSelection()

    // A selection spanning text is not somebody typing a name.
    if (!range || range.length > 0) {
      this.close()
      return
    }

    const query = findMentionQuery(textBeforeCaret(this.quill, range.index))

    if (!query) {
      this.close()
      return
    }

    const unchanged = this.query?.index === query.index && this.query?.term === query.term
    this.query = query

    if (unchanged && !this.root.hidden) return

    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => this.run(query.term), SEARCH_DEBOUNCE_MS)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.root.hidden || this.candidates.length === 0) return

    const stop = () => {
      event.preventDefault()
      event.stopPropagation()
    }

    switch (event.key) {
      case 'ArrowDown': {
        this.move(1)
        stop()
        break
      }
      case 'ArrowUp': {
        this.move(-1)
        stop()
        break
      }
      case 'Enter':
      case 'Tab': {
        this.insert(this.candidates[this.activeIndex])
        stop()
        break
      }
      case 'Escape': {
        this.close()
        stop()
        break
      }
      default: {
        break
      }
    }
  }

  private handleMouseDown = (event: MouseEvent): void => {
    const option = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-mention-index]')

    if (!option) return

    // Keeps focus — and with it the selection the insert replaces — in the
    // editor. Without this the click blurs it and the mention lands nowhere.
    event.preventDefault()

    this.insert(this.candidates[Number(option.dataset.mentionIndex)])
  }

  private handleSelectionChange = (range: unknown): void => {
    // Null while the editor is not focused — a blur is not a caret moving out
    // of a mention, and closing on it would beat the click on the list.
    if (!range) return

    this.detect()
  }

  private handleTextChange = (_delta: unknown, _old: unknown, source: string): void => {
    // Anything but typing — a draft being loaded, a paste rewritten by another
    // module — is not somebody reaching for the picker.
    if (source !== 'user') {
      this.close()
      return
    }

    this.detect()
  }

  /**
   * Replace the typed trigger with a link to the member.
   *
   * The "@" goes with it. It is how a mention is *started*, not how one has to
   * read afterwards — the chip's own colour already says this is a person and
   * not an ordinary link, and the name sits in the sentence the way it would if
   * the author had simply written it. What marks the link as a mention for the
   * server is the class, which MentionService reads back off the stored words.
   */
  private insert(candidate: MentionCandidate | undefined): void {
    const query = this.query

    if (!candidate || !query) return

    const label = candidate.name
    const quill = this.quill

    this.close()

    quill.deleteText(query.index, query.length, 'user')
    quill.insertText(query.index, label, { mention: { href: candidate.href } }, 'user')
    // Unformatted, so what the author types next is their own words rather than
    // more of the link — and so there is a gap to type them in.
    quill.insertText(query.index + label.length, ' ', { mention: false }, 'user')
    quill.setSelection(query.index + label.length + 1, 0, 'user')
  }

  private move(step: number): void {
    const count = this.candidates.length

    if (count === 0) return

    this.activeIndex = (this.activeIndex + step + count) % count
    this.paintActive()
  }

  private paintActive(): void {
    for (const [index, option] of [...this.root.children].entries()) {
      const isActive = index === this.activeIndex
      option.setAttribute('aria-selected', String(isActive))

      if (isActive) {
        this.quill.root.setAttribute('aria-activedescendant', option.id)
        option.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  private render(candidates: MentionCandidate[]): void {
    // No answer is not worth a box saying so: it would sit over the words while
    // somebody types an address, and swallow the Enter that ends their line.
    if (candidates.length === 0) {
      this.close()
      return
    }

    this.candidates = candidates
    this.activeIndex = 0
    this.root.replaceChildren(
      ...candidates.map((candidate, index) => this.renderOption(candidate, index))
    )
    this.root.hidden = false
    this.quill.root.setAttribute('aria-expanded', 'true')

    this.paintActive()
    this.reposition()
  }

  private renderOption(candidate: MentionCandidate, index: number): HTMLElement {
    const option = document.createElement('div')
    option.className = styles.option
    option.id = `${this.root.id}-${index}`
    option.dataset.mentionIndex = String(index)
    option.setAttribute('role', 'option')

    if (candidate.avatar) {
      const avatar = document.createElement('img')
      avatar.className = styles.avatar
      avatar.src = candidate.avatar
      // Decorative: the name beside it is the option's label.
      avatar.alt = ''
      // Gravatar is the default source and is not reachable from every network
      // a forum runs on. A broken image leaves a torn icon in the middle of the
      // row; no image at all just leaves the name, which is the part that
      // identifies the member anyway.
      avatar.addEventListener('error', () => avatar.remove())
      option.append(avatar)
    }

    const name = document.createElement('span')
    name.className = styles.name
    name.textContent = candidate.name
    option.append(name)

    const slug = document.createElement('span')
    slug.className = styles.slug
    slug.textContent = `@${candidate.slug}`
    option.append(slug)

    return option
  }

  /**
   * Sit the list under the "@", flipping above it when there is no room below.
   *
   * Fixed positioning, because the list is on the body: the caret's coordinates
   * come from the viewport and go straight back to it, with no offset parent in
   * between to account for.
   */
  private reposition = (): void => {
    if (this.root.hidden || !this.query) return

    const caret = this.quill.getBounds(this.query.index, this.query.length)

    if (!caret) {
      this.close()
      return
    }

    const editor = this.quill.container.getBoundingClientRect()
    const list = this.root.getBoundingClientRect()

    const below = editor.top + caret.bottom + GUTTER_PX
    const above = editor.top + caret.top - list.height - GUTTER_PX
    const fitsBelow = below + list.height <= window.innerHeight - GUTTER_PX

    const left = Math.min(
      Math.max(GUTTER_PX, editor.left + caret.left),
      Math.max(GUTTER_PX, window.innerWidth - list.width - GUTTER_PX)
    )

    this.root.style.top = `${fitsBelow || above < GUTTER_PX ? below : above}px`
    this.root.style.left = `${left}px`
  }

  private async run(term: string): Promise<void> {
    this.controller?.abort()

    const controller = new AbortController()
    this.controller = controller
    const id = ++this.requestId

    try {
      const found = await this.options.search(term, controller.signal)

      if (id !== this.requestId || !this.query) return

      this.render(found)
    } catch {
      // Includes the abort of a superseded search, which is not a failure and
      // must not close a list a newer search has already filled.
      if (id === this.requestId) this.close()
    }
  }
}

Quill.register('modules/mention', MentionModule)
