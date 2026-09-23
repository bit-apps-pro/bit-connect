import { describe, expect, it } from 'vitest'

import { normalizeFailure } from './failure'

describe('normalizeFailure', () => {
  it("passes the plugin's own envelope through untouched", () => {
    const body = { code: 'VALIDATION', data: { post_title: ['Required'] }, status: 'error' }

    expect(normalizeFailure(body, 'fallback')).toBe(body)
  })

  it('turns a WordPress fatal into plain text in data and message', () => {
    const failure = normalizeFailure(
      {
        code: 'internal_server_error',
        data: { status: 500 },
        message: '<p>There has been a critical error on this website.</p>'
      },
      'fallback'
    )

    expect(failure).toEqual({
      code: 'internal_server_error',
      data: 'There has been a critical error on this website.',
      message: 'There has been a critical error on this website.',
      status: 'error'
    })
  })

  it('falls back when the body carries no message', () => {
    expect(normalizeFailure(undefined, 'Request failed')).toEqual({
      code: 'ERROR',
      data: 'Request failed',
      message: 'Request failed',
      status: 'error'
    })
  })
})
