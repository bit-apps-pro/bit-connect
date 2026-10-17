import type Quill from 'quill'

interface Context { quill: Quill }
interface Line { formats: () => Record<string, unknown>; length: () => number; next: Line | null }
interface Range { index: number; length: number }

const CODE = 'code-block'

const isCode = (line: Line | null | undefined): boolean => Boolean(line?.formats()[CODE])

/**
 * Ways out of a code block.
 *
 * Quill's own exit is Enter on an empty line after an empty line — three
 * presses at the end of the block, which nobody finds — and a block that ends
 * the post has no line below it to arrow down to, so members were stuck
 * typing inside it.
 *
 * - Enter on an empty last line of a block turns that line into a paragraph:
 *   Enter twice at the end leaves, as in most editors. A blank line in the
 *   middle of the block is still just a blank line.
 * - ArrowDown on the last line of a block that ends the post opens a
 *   paragraph below it.
 *
 * Passed as `modules.keyboard.bindings`; `code exit` replaces Quill's binding
 * of that name rather than running beside it.
 */
export const codeExitBindings = {
  'code exit': {
    collapsed: true,
    format: [CODE],
    handler(this: Context, range: Range) {
      const [line] = this.quill.getLine(range.index) as unknown as [Line | null, number]
      if (!line || isCode(line.next)) return true

      this.quill.formatLine(range.index, 0, CODE, false, 'user')
      return false
    },
    key: 'Enter',
    prefix: /^$/,
    suffix: /^$/
  },
  'code exit down': {
    collapsed: true,
    format: [CODE],
    handler(this: Context, range: Range) {
      const quill = this.quill
      const [line, offset] = quill.getLine(range.index) as unknown as [Line | null, number]
      if (!line) return true

      const lineEnd = range.index - offset + line.length() - 1
      // Anything after this line — the next line of the block, or a paragraph
      // below it — and the arrow already has somewhere to go.
      if (lineEnd < quill.getLength() - 1) return true

      // A newline carrying the block's format ends this line inside the block;
      // the document's final newline then closes an empty line of its own,
      // which is made a paragraph.
      quill.insertText(lineEnd, '\n', { [CODE]: line.formats()[CODE] }, 'user')
      quill.formatLine(lineEnd + 1, 0, CODE, false, 'user')
      quill.setSelection(lineEnd + 1, 0, 'user')
      return false
    },
    key: 'ArrowDown'
  }
}
