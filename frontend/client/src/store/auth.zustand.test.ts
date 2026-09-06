import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from './auth.zustand'
import { getCurrentUserApi, loginApi, logoutApi, signupApi } from './data/auth-api'

vi.mock('./data/auth-api', () => ({
  getCurrentUserApi: vi.fn(),
  loginApi: vi.fn(),
  logoutApi: vi.fn(),
  signupApi: vi.fn()
}))

vi.mock('@config/config', () => ({
  default: { CURRENT_USER: undefined, IS_LOGGED_IN: false }
}))

const member = (capabilities: string[] = []) => ({
  capabilities: Object.fromEntries(capabilities.map(capability => [capability, true])),
  display_name: 'Rahim',
  email: 'rahim@example.com',
  id: 7,
  roles: ['subscriber'],
  username: 'rahim'
})

/** The store between tests — zustand keeps one instance for the module. */
const reset = () =>
  useAuthStore.setState({
    capabilities: {},
    error: undefined,
    isLoading: false,
    isLoggedIn: false,
    pendingVerificationEmail: undefined,
    user: undefined
  })

beforeEach(() => {
  vi.clearAllMocks()
  reset()
})

describe('signing in', () => {
  it('keeps the member and what they may do', async () => {
    vi.mocked(loginApi).mockResolvedValue({ data: member(['forum_create_post']) } as never)

    await useAuthStore.getState().login({ password: 'x', username: 'rahim' })

    const state = useAuthStore.getState()

    expect(state.isLoggedIn).toBe(true)
    expect(state.user?.id).toBe(7)
    expect(state.isLoading).toBe(false)
  })

  // Gating on a capability rather than on a role name is the rule: a role says
  // nothing about what Manager granted it.
  it('answers what the member may do from their capabilities', async () => {
    vi.mocked(loginApi).mockResolvedValue({ data: member(['forum_create_post']) } as never)

    await useAuthStore.getState().login({ password: 'x', username: 'rahim' })

    expect(useAuthStore.getState().can('forum_create_post')).toBe(true)
    expect(useAuthStore.getState().can('forum_moderate')).toBe(false)
  })

  it('leaves the member signed out when a refusal comes back', async () => {
    vi.mocked(loginApi).mockRejectedValue({ message: 'Wrong password.' })

    await expect(
      useAuthStore.getState().login({ password: 'x', username: 'rahim' })
    ).rejects.toBeDefined()

    const state = useAuthStore.getState()

    expect(state.isLoggedIn).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Wrong password.')
  })

  // A 200 with no user in it is a failure however the status line reads.
  it('treats a success carrying no member as a failure', async () => {
    vi.mocked(loginApi).mockResolvedValue({ data: undefined } as never)

    await expect(
      useAuthStore.getState().login({ password: 'x', username: 'rahim' })
    ).rejects.toBeDefined()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
  })
})

// These messages are the only thing the sign-in form has to show, so a shape
// the reader cannot be shown falls through to the next one rather than
// rendering "[object Object]".
/**
 * Fails a sign-in with the given rejection and answers the message the form
 * would show.
 *
 * Caught rather than asserted on: login rethrows whatever it was given, and one
 * of the shapes under test is `undefined` itself.
 */
async function failWith(error: unknown) {
  vi.mocked(loginApi).mockRejectedValue(error)

  try {
    await useAuthStore.getState().login({ password: 'x', username: 'rahim' })
    throw new Error('login should have rejected')
  } catch {
    return useAuthStore.getState().error
  }
}

describe('the message a failure is shown as', () => {
  it('names the field a validation error came from', async () => {
    const message = await failWith({
      code: 'VALIDATION',
      data: { user_email: ['is not a valid address'] }
    })

    expect(message).toBe('User Email: is not a valid address')
  })

  it('joins several validation errors rather than showing one', async () => {
    const message = await failWith({
      code: 'VALIDATION',
      data: { password: ['is too short', 'needs a number'], username: ['is taken'] }
    })

    expect(message).toContain('Password: is too short, needs a number')
    expect(message).toContain('Username: is taken')
  })

  it('reads a plain string body as the message', async () => {
    expect(await failWith({ data: 'That account is locked.' })).toBe('That account is locked.')
  })

  it('reads a message nested under data', async () => {
    expect(await failWith({ data: { message: 'Nested.' } })).toBe('Nested.')
  })

  it('reads a top-level message', async () => {
    expect(await failWith({ message: 'Top level.' })).toBe('Top level.')
  })

  it('still says something for a shape it does not recognise', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- the absent value is the case under test
    expect(await failWith(undefined)).toBe('An unexpected error occurred')
    expect(await failWith('a bare string')).toBe('An unexpected error occurred')
    expect(await failWith({})).toBe('An unexpected error occurred')
  })
})

describe('signing up', () => {
  it('signs the member straight in when the forum does not verify email', async () => {
    vi.mocked(signupApi).mockResolvedValue({ data: member() } as never)

    await useAuthStore.getState().signup({
      email: 'rahim@example.com',
      password: 'x',
      username: 'rahim'
    } as never)

    expect(useAuthStore.getState().isLoggedIn).toBe(true)
  })

  // Held rather than signed in: the address is kept so the screen can say where
  // the email went and offer to send it again.
  it('holds the member at verification when the forum verifies email', async () => {
    vi.mocked(signupApi).mockResolvedValue({
      data: { email: 'rahim@example.com', status: 'verification_pending' }
    } as never)

    await useAuthStore.getState().signup({
      email: 'rahim@example.com',
      password: 'x',
      username: 'rahim'
    } as never)

    const state = useAuthStore.getState()

    expect(state.isLoggedIn).toBe(false)
    expect(state.pendingVerificationEmail).toBe('rahim@example.com')
  })

  it('reports a signup that came back with nothing usable', async () => {
    vi.mocked(signupApi).mockResolvedValue({ data: {} } as never)

    await expect(
      useAuthStore.getState().signup({ email: 'x', password: 'x', username: 'x' } as never)
    ).rejects.toBeDefined()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
  })
})

describe('checking who is signed in', () => {
  it('adopts the member the server reports', async () => {
    vi.mocked(getCurrentUserApi).mockResolvedValue({ data: member(['forum_moderate']) } as never)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().isLoggedIn).toBe(true)
    expect(useAuthStore.getState().can('forum_moderate')).toBe(true)
  })

  it('clears the session when the server reports nobody', async () => {
    useAuthStore.setState({ isLoggedIn: true, user: member() as never })
    vi.mocked(getCurrentUserApi).mockResolvedValue({ data: undefined } as never)

    await useAuthStore.getState().checkAuth()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().user).toBeUndefined()
  })

  // Not being signed in is the ordinary state for a portal visitor, not an
  // error worth showing them.
  it('says nothing when the check itself fails', async () => {
    vi.mocked(getCurrentUserApi).mockRejectedValue(new Error('403'))

    await useAuthStore.getState().checkAuth()

    const state = useAuthStore.getState()

    expect(state.isLoggedIn).toBe(false)
    expect(state.error).toBeUndefined()
    expect(state.isLoading).toBe(false)
  })
})

describe('signing out', () => {
  it('clears the session', async () => {
    useAuthStore.setState({ isLoggedIn: true, user: member() as never })
    vi.mocked(logoutApi).mockResolvedValue(undefined as never)

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().user).toBeUndefined()
  })

  // A member who pressed Sign out and stayed signed in is worse than one whose
  // request failed silently, so the session goes either way.
  it('clears the session even when the request fails', async () => {
    useAuthStore.setState({ isLoggedIn: true, user: member() as never })
    vi.mocked(logoutApi).mockRejectedValue(new Error('Network down'))

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().user).toBeUndefined()
  })
})

describe('setting the member directly', () => {
  it('recomputes what they may do', () => {
    useAuthStore.getState().setUser(member(['forum_pin_post']) as never)

    expect(useAuthStore.getState().isLoggedIn).toBe(true)
    expect(useAuthStore.getState().can('forum_pin_post')).toBe(true)
  })

  it('signs them out when handed nothing', () => {
    useAuthStore.getState().setUser(member(['forum_pin_post']) as never)
    useAuthStore.getState().setUser(undefined)

    expect(useAuthStore.getState().isLoggedIn).toBe(false)
    expect(useAuthStore.getState().can('forum_pin_post')).toBe(false)
  })
})
