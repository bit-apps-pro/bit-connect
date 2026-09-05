import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import If from './If'

describe('If component', () => {
  afterEach(cleanup)

  it('renders children when the condition is truthy', () => {
    render(<If conditions>visible content</If>)
    expect(screen.getByText('visible content')).toBeTruthy()
  })

  it('renders children when all array conditions are truthy', () => {
    render(<If conditions={[true, 1, 'yes']}>all true</If>)
    expect(screen.getByText('all true')).toBeTruthy()
  })

  it('renders nothing when the condition is falsy', () => {
    render(<If conditions={false}>hidden content</If>)
    // eslint-disable-next-line unicorn/no-null
    expect(screen.queryByText('hidden content')).toBe(null)
  })

  it('renders nothing when any array condition is falsy', () => {
    render(<If conditions={[true, 0, true]}>hidden content</If>)
    // eslint-disable-next-line unicorn/no-null
    expect(screen.queryByText('hidden content')).toBe(null)
  })
})
