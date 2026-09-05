import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import Note from './Note'

describe('Note component', () => {
  afterEach(cleanup)

  it('renders the note text', () => {
    render(<Note note="A simple note" />)
    expect(screen.getByText('A simple note')).toBeTruthy()
  })

  it('joins an array of notes into a single block', () => {
    render(<Note note={['first line', 'second line']} />)
    expect(screen.getByText(/first line/)).toBeTruthy()
    expect(screen.getByText(/second line/)).toBeTruthy()
  })

  it('calls onRender once on mount', () => {
    const onRender = vi.fn()
    render(<Note note="hi" onRender={onRender} />)
    expect(onRender).toHaveBeenCalledTimes(1)
  })
})
