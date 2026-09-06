import { beforeEach, describe, expect, it, vi } from 'vitest'

// The resolvers read the server-injected config, so each case rebuilds it.
const config = {
  AUTH_MODE: 'plugin_default' as 'custom_url' | 'plugin_default',
  CAN_REGISTER: true,
  CUSTOM_LOGIN_URL: '',
  CUSTOM_REGISTRATION_URL: '',
  POST_URL: '/portal',
  SITE_URL: 'https://example.com',
  WP_LOGIN_URL: 'https://example.com/wp-login.php',
  WP_REGISTER_URL: 'https://example.com/wp-login.php?action=register'
}

vi.mock('@config/config', () => ({ default: config }))

const { externalLoginUrl, externalRegisterUrl, portalUrl, registrationIsOffered } =
  await import('./auth-urls')

function setConfig(patch: Partial<typeof config>) {
  Object.assign(config, patch)
}

beforeEach(() => {
  setConfig({
    AUTH_MODE: 'plugin_default',
    CAN_REGISTER: true,
    CUSTOM_LOGIN_URL: '',
    CUSTOM_REGISTRATION_URL: '',
    POST_URL: '/portal',
    SITE_URL: 'https://example.com'
  })
})

describe('portalUrl', () => {
  it('includes the portal page path the router basename strips', () => {
    expect(portalUrl('/a-topic')).toBe('https://example.com/portal/a-topic')
  })

  it('does not double up slashes when the portal is the front page', () => {
    setConfig({ POST_URL: '/' })
    expect(portalUrl('/a-topic')).toBe('https://example.com/a-topic')
    expect(portalUrl('/')).toBe('https://example.com/')
  })

  // A subdirectory install roots the portal at the install path, so the
  // basename is /forum rather than / — the site is still "at the root", just
  // not the domain's.
  it('keeps the install path when the portal is the front page of a subdirectory install', () => {
    setConfig({ POST_URL: '/forum', SITE_URL: 'https://example.com' })
    expect(portalUrl('/a-topic')).toBe('https://example.com/forum/a-topic')
    expect(portalUrl('/')).toBe('https://example.com/forum/')
  })
})

describe('externalLoginUrl', () => {
  it('returns undefined in plugin-default mode so the portal renders its own form', () => {
    expect(externalLoginUrl('/a-topic')).toBeUndefined()
  })

  it('redirects to the configured page and back to the portal path', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: 'https://example.com/members/login' })

    const url = new URL(externalLoginUrl('/a-topic') as string)
    expect(url.origin + url.pathname).toBe('https://example.com/members/login')
    expect(url.searchParams.get('redirect_to')).toBe('https://example.com/portal/a-topic')
  })

  it('falls back to the WordPress login page when no custom URL is set', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: '' })

    expect(externalLoginUrl('/')).toContain('https://example.com/wp-login.php')
  })

  it('resolves a site-relative custom URL instead of throwing', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: '/members/login' })

    expect(externalLoginUrl('/')).toContain('https://example.com/members/login')
  })

  it('accepts a scheme-less host', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: 'accounts.example.org/login' })

    expect(externalLoginUrl('/')).toContain('https://accounts.example.org/login')
  })

  // A self-referencing custom URL is a redirect loop, but only the server can
  // recognise one: it arrives here already blanked, and blank means "fall back".
  it('falls back when the server blanked a custom URL pointing at the portal itself', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: '' })

    expect(externalLoginUrl('/')).toContain('https://example.com/wp-login.php')
  })

  // Regression: the portal served at the site root has an empty basename, which
  // used to make every /login on the site look like the portal's own route — so
  // a perfectly good custom login page was discarded for wp-login.php.
  it('keeps a site-root login page when the portal is the front page', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CUSTOM_LOGIN_URL: 'https://example.com/login/',
      POST_URL: '/'
    })

    const url = new URL(externalLoginUrl('/') as string)
    expect(url.origin + url.pathname).toBe('https://example.com/login/')
    expect(url.searchParams.get('redirect_to')).toBe('https://example.com/')
  })

  it('keeps an already absolute redirect target', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: 'https://example.com/members/login' })

    const url = new URL(externalLoginUrl('https://example.com/portal/x') as string)
    expect(url.searchParams.get('redirect_to')).toBe('https://example.com/portal/x')
  })
})

describe('externalRegisterUrl', () => {
  it('returns undefined in plugin-default mode', () => {
    expect(externalRegisterUrl('/')).toBeUndefined()
  })

  it('prefers the configured registration page', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CUSTOM_LOGIN_URL: 'https://example.com/members/login',
      CUSTOM_REGISTRATION_URL: 'https://example.com/members/join'
    })

    expect(externalRegisterUrl('/')).toContain('https://example.com/members/join')
  })

  it('uses the custom login page when only that one is configured', () => {
    setConfig({ AUTH_MODE: 'custom_url', CUSTOM_LOGIN_URL: 'https://example.com/members/login' })

    expect(externalRegisterUrl('/')).toContain('https://example.com/members/login')
  })

  it('falls back to the WordPress registration page when nothing is configured', () => {
    setConfig({ AUTH_MODE: 'custom_url' })

    expect(externalRegisterUrl('/')).toContain('action=register')
  })

  it('keeps a site-root registration page when the portal is the front page', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CUSTOM_REGISTRATION_URL: 'https://example.com/register/',
      POST_URL: '/'
    })

    expect(externalRegisterUrl('/')).toContain('https://example.com/register/')
  })
})

describe('registrationIsOffered', () => {
  it('follows users_can_register in plugin-default mode', () => {
    expect(registrationIsOffered()).toBe(true)

    setConfig({ CAN_REGISTER: false })
    expect(registrationIsOffered()).toBe(false)
  })

  // The whole point of custom-URL mode: a membership plugin owns sign-up, and
  // those plugins commonly leave users_can_register off. Hiding the entry point
  // would leave a new visitor with no way to create an account.
  it('offers the configured registration page even when users_can_register is off', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CAN_REGISTER: false,
      CUSTOM_REGISTRATION_URL: 'https://example.com/members/join'
    })

    expect(registrationIsOffered()).toBe(true)
  })

  it('offers a combined custom login page when users_can_register is off', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CAN_REGISTER: false,
      CUSTOM_LOGIN_URL: 'https://example.com/members/login'
    })

    expect(registrationIsOffered()).toBe(true)
  })

  // Nothing configured means the resolver would land on
  // wp-login.php?action=register, which only renders WordPress' own
  // "registration is not allowed" notice while the option is off.
  it('hides registration in custom-URL mode when nothing is configured and WP forbids it', () => {
    setConfig({ AUTH_MODE: 'custom_url', CAN_REGISTER: false })

    expect(registrationIsOffered()).toBe(false)
  })

  it('still offers WordPress registration in custom-URL mode when WP allows it', () => {
    setConfig({ AUTH_MODE: 'custom_url', CAN_REGISTER: true })

    expect(registrationIsOffered()).toBe(true)
  })

  // Same regression as externalLoginUrl's: with the portal on the front page the
  // basename is empty, and /register used to read as the portal's own route —
  // which hid the entry point entirely on a site where users_can_register is off.
  it('offers a site-root registration page when the portal is the front page', () => {
    setConfig({
      AUTH_MODE: 'custom_url',
      CAN_REGISTER: false,
      CUSTOM_REGISTRATION_URL: 'https://example.com/register/',
      POST_URL: '/'
    })

    expect(registrationIsOffered()).toBe(true)
  })
})
