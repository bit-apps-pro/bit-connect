import { describe, expect, it } from 'vitest'

import { validateAuthForm } from './auth-validation'

// Custom-URL mode only works when the login page it points at is reachable.
// Both the settings screen and the onboarding wizard apply this rule, and the
// server enforces it too — a mismatch between them is how blank auth settings
// used to get saved, leaving a portal whose sign-in link went nowhere.
const custom = (fields: Partial<Parameters<typeof validateAuthForm>[0]> = {}) => ({
  customLoginUrl: 'https://example.com/login',
  customRegistrationUrl: '',
  mode: 'custom_url' as const,
  ...fields
})

describe('validateAuthForm', () => {
  it('accepts an absolute login URL', () => {
    expect(validateAuthForm(custom())).toBeUndefined()
  })

  it('accepts plain http as well as https', () => {
    expect(validateAuthForm(custom({ customLoginUrl: 'http://example.com/login' }))).toBeUndefined()
  })

  it('refuses a login URL that is missing', () => {
    expect(validateAuthForm(custom({ customLoginUrl: '' }))).toMatch(/Custom Login Page URL/)
    expect(validateAuthForm(custom({ customLoginUrl: '   ' }))).toMatch(/Custom Login Page URL/)
  })

  // A relative path cannot be redirected to from the places this is used.
  it('refuses a path rather than a URL', () => {
    expect(validateAuthForm(custom({ customLoginUrl: '/login' }))).toMatch(/Custom Login Page URL/)
    expect(validateAuthForm(custom({ customLoginUrl: 'example.com/login' }))).toMatch(
      /Custom Login Page URL/
    )
  })

  it('refuses a scheme that is not http', () => {
    expect(validateAuthForm(custom({ customLoginUrl: 'javascript:alert(1)' }))).toMatch(
      /Custom Login Page URL/
    )
    expect(validateAuthForm(custom({ customLoginUrl: 'ftp://example.com/login' }))).toMatch(
      /Custom Login Page URL/
    )
  })

  it('refuses a URL with no host', () => {
    expect(validateAuthForm(custom({ customLoginUrl: 'https://' }))).toMatch(/Custom Login Page URL/)
  })

  // A combined login/registration page is the common setup, and the portal
  // falls back to the login page for sign-ups.
  it('lets the registration URL be left out', () => {
    expect(validateAuthForm(custom({ customRegistrationUrl: '' }))).toBeUndefined()
    expect(validateAuthForm(custom({ customRegistrationUrl: '   ' }))).toBeUndefined()
    expect(validateAuthForm(custom({ customRegistrationUrl: undefined }))).toBeUndefined()
  })

  it('still checks the registration URL once one is given', () => {
    expect(validateAuthForm(custom({ customRegistrationUrl: 'register' }))).toMatch(
      /Custom Registration Page URL/
    )
  })

  it('accepts a registration URL of its own', () => {
    expect(
      validateAuthForm(custom({ customRegistrationUrl: 'https://example.com/register' }))
    ).toBeUndefined()
  })

  it('reports the login URL first when both are wrong', () => {
    expect(
      validateAuthForm(custom({ customLoginUrl: 'nope', customRegistrationUrl: 'also-nope' }))
    ).toMatch(/Custom Login Page URL/)
  })

  // The URLs are only read in custom mode, so an old value left in the form
  // must not block saving a switch back to WordPress's own login.
  it('ignores the URLs entirely outside custom mode', () => {
    expect(
      validateAuthForm({
        customLoginUrl: '',
        customRegistrationUrl: 'rubbish',
        mode: 'plugin_default'
      })
    ).toBeUndefined()
  })
})
