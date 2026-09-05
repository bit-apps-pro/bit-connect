/**
 * Quill's list markup → real <ul> and <ol> trees.
 *
 * Quill 2 describes a list in two ways that nothing downstream understands:
 *
 *  - Bulleted or numbered, every list is one <ol> container, and the kind is
 *    recorded per item in `data-list` (`ListContainer.tagName = 'OL'` in
 *    quill/formats/list.js).
 *  - Nesting is not nesting. Indented items stay flat siblings carrying a
 *    `ql-indent-N` class.
 *
 *      <ol>
 *        <li data-list="bullet">parent</li>
 *        <li data-list="bullet" class="ql-indent-1">child</li>
 *      </ol>
 *
 * Neither survives storage: wp_kses allows only `class` and `id` on <li>
 * (ContentSanitizerService::getAllowedHtml), the formatters strip `data-list`
 * outright, and `ql-*` classes are stripped as Quill's own. Left alone, every
 * bullet list comes back numbered and every indented item comes back flat.
 *
 * So both have to be resolved into ordinary HTML while the markup that states
 * them is still there — which means before the formatters' walk, since that
 * walk strips `ql-indent-N` off the items on its way to the list itself.
 */

/**
 * The one `data-list` value that means a numbered item. Everything else —
 * `bullet`, and the `checked`/`unchecked` of task lists — draws a marker
 * rather than a number, so it belongs in a <ul>.
 */
const ORDERED = 'ordered'

const INDENT_PATTERN = /\bql-indent-(\d+)\b/

/**
 * Rewrite every Quill list under `root` in place.
 *
 * Lists carrying no `data-list` are left as they are: those came from a paste
 * and already say what they are, and rebuilding them would only risk dropping
 * markup this module does not model.
 */
export function normalizeQuillLists(root: Element): void {
  // querySelectorAll is a static snapshot in document order, so a list is
  // rewritten before any list nested inside it. Items are moved rather than
  // cloned, which keeps those inner lists live and reachable when their own
  // turn comes.
  for (const list of root.querySelectorAll('ol')) {
    for (const run of splitByListType(list)) {
      nestIndentedItems(run)
    }
  }
}

/**
 * Replace one Quill <ol> with a run of <ul>/<ol> siblings, one per stretch of
 * consecutive items sharing a marker style, and return what it became.
 *
 * A list the author never mixed comes out as a single element, which is the
 * ordinary case: a bullet list becomes one <ul>.
 */
function splitByListType(list: Element): Element[] {
  const items = [...list.children].filter((child): child is HTMLElement => child.tagName === 'LI')
  if (!items.some(li => Object.hasOwn(li.dataset, 'list'))) return [list]

  const doc = list.ownerDocument
  const runs: Element[] = []
  let currentTag = ''

  for (const li of items) {
    const tag = li.dataset.list === ORDERED ? 'ol' : 'ul'
    delete li.dataset.list

    if (tag !== currentTag) {
      const run = doc.createElement(tag)
      // Carry the container's classes across. `ql-indent-N` lives on the
      // items, not here, so this is only ever a class a paste brought in.
      const className = list.getAttribute('class')
      if (className) run.setAttribute('class', className)
      runs.push(run)
      currentTag = tag
    }

    runs.at(-1)?.append(li)
  }

  list.replaceWith(...runs)
  return runs
}

/**
 * Turn `ql-indent-N` siblings into a real nested list.
 *
 * The sub-list is created with its parent's tag, so an indented run under a
 * <ul> stays bulleted. Quill cannot express a numbered list nested under a
 * bulleted one in a single container anyway — switching the marker starts a
 * new run, which `splitByListType` has already separated out by the time this
 * runs.
 */
function nestIndentedItems(list: Element): void {
  const items = [...list.children].filter(child => child.tagName === 'LI')
  if (!items.some(li => INDENT_PATTERN.test(li.className))) return

  const doc = list.ownerDocument
  const tag = list.tagName.toLowerCase()
  const stack: { depth: number; el: Element }[] = [{ depth: 0, el: list }]
  // The item placed on the previous pass. A sub-list hangs off it, which is
  // what makes the indented run a child in the published markup rather than a
  // sibling. Tracking it beats reading the last child back off the list: until
  // an item is placed it is still sitting in the container being rewritten, so
  // "the last <li>" can be the very item being placed.
  let previous: Element | undefined

  for (const li of items) {
    const depth = takeIndentDepth(li)

    // Climb back out to the shallowest list that can still hold this item.
    while (stack.length > 1 && (stack.at(-1)?.depth ?? 0) >= depth) {
      stack.pop()
    }

    // Going deeper opens a sub-list under the item above. With no item above —
    // the author indented the very first line — there is nothing to nest into,
    // so it stays top level.
    if (depth > (stack.at(-1)?.depth ?? 0) && previous) {
      const subList = doc.createElement(tag)
      previous.append(subList)
      stack.push({ depth, el: subList })
    }

    stack.at(-1)?.el.append(li)
    previous = li
  }
}

/** Read an item's indent depth, removing the class that carried it. */
function takeIndentDepth(li: Element): number {
  const match = li.className.match(INDENT_PATTERN)
  if (!match) return 0

  li.classList.remove(`ql-indent-${match[1]}`)
  if (!li.className.trim()) li.removeAttribute('class')

  return Number.parseInt(match[1], 10)
}
