import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import QuillEditor from './QuillEditor'

/** Quill's contenteditable. happy-dom gives it no implicit role to query by. */
const editor = () => document.querySelector('.ql-editor') as HTMLElement
const button = (name: string) => screen.getByRole('button', { name })

describe('QuillEditor block formats', () => {
  afterEach(cleanup)

  it('offers the block formats the storage pipeline already supports', () => {
    render(<QuillEditor />)

    expect(button('Bulleted list')).toBeInTheDocument()
    expect(button('Numbered list')).toBeInTheDocument()
    expect(button('Code block')).toBeInTheDocument()
  })

  // The value handed to onChange is what the API is sent, so these assert the
  // whole path: toolbar → Quill → formatForWordPress.
  it('reports a bulleted list as a <ul>, not the <ol> Quill renders', async () => {
    const onChange = vi.fn()
    render(<QuillEditor onChange={onChange} />)

    await userEvent.click(editor())
    await userEvent.keyboard('one')
    await userEvent.click(button('Bulleted list'))

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ul class="wp-block-list"'))
    })
    expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining('data-list'))
  })

  it('reports a numbered list as an <ol>', async () => {
    const onChange = vi.fn()
    render(<QuillEditor onChange={onChange} />)

    await userEvent.click(editor())
    await userEvent.keyboard('one')
    await userEvent.click(button('Numbered list'))

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ol class="wp-block-list"'))
    })
  })

  it('reports a code block as Gutenberg stores one', async () => {
    const onChange = vi.fn()
    render(<QuillEditor onChange={onChange} />)

    await userEvent.click(editor())
    await userEvent.keyboard('wp_die();')
    await userEvent.click(button('Code block'))

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(
        expect.stringContaining('<pre class="wp-block-code"><code>')
      )
    })
  })

  it('marks the active format so the button reads as pressed', async () => {
    render(<QuillEditor />)

    await userEvent.click(editor())
    await userEvent.keyboard('one')
    await userEvent.click(button('Bulleted list'))

    await waitFor(() => {
      expect(button('Bulleted list')).toHaveAttribute('aria-pressed', 'true')
    })
    expect(button('Numbered list')).toHaveAttribute('aria-pressed', 'false')
  })

  // Below md the block formats live behind ⋯ instead of on the toolbar. Both
  // copies are in the DOM at once — CSS decides which one is shown — so the
  // menu row has to reach the same handler and the same saved selection.
  it('applies a block format chosen from the overflow menu', async () => {
    const onChange = vi.fn()
    render(<QuillEditor onChange={onChange} />)

    await userEvent.click(editor())
    await userEvent.keyboard('one')
    await userEvent.click(button('More formatting'))

    // The menu renders into a portal, so its copy is the later of the two.
    const menuRow = screen.getAllByRole('button', { name: 'Bulleted list' }).at(-1)
    await userEvent.click(menuRow as HTMLElement)

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ul class="wp-block-list"'))
    })
  })

  it('turns the list off when the same button is pressed again', async () => {
    const onChange = vi.fn()
    render(<QuillEditor onChange={onChange} />)

    await userEvent.click(editor())
    await userEvent.keyboard('one')
    await userEvent.click(button('Bulleted list'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('<ul')))

    await userEvent.click(button('Bulleted list'))

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.not.stringContaining('<ul'))
    })
  })
})
