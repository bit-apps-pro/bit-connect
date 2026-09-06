import get from '@utils/request/get'
import { setNonce } from '@utils/request/nonce'
import post from '@utils/request/post'
import { type ResponseType } from '@utils/request/types'
import { wpApi } from '@utils/request/wp-api'

import { type CapabilityMap } from '../helper/capabilities'

export interface User {
  avatar: string
  /**
   * Forum capabilities as the server answers them, so the portal gates its
   * controls on the same checks the REST layer enforces. Absent on the WP-core
   * fallback endpoint, which cannot report them — see `capabilitiesOf()`.
   */
  capabilities?: CapabilityMap
  display_name: string
  email: string
  /**
   * False for an account created by an SSO plugin with no password at all, who
   * must be offered "set a password" rather than asked for a current one.
   * Undefined only on the WP-core fallback, which cannot report it — treated as
   * true, since asking for a password that exists is the safe default.
   */
  has_password?: boolean
  id: number
  /**
   * An address they asked to move to but have not confirmed yet. Only the
   * plugin's own `auth/me` supplies it; the WP-core fallback cannot.
   */
  pending_email?: string
  role: string | undefined
  roles: string[]
  /** Profile slug for `/user/:userSlug`. Optional: the WP-core fallback endpoint cannot supply it. */
  slug?: string
  username: string
}

export interface LoginPayload {
  password: string
  remember?: boolean
  username: string
}

export interface SignupPayload {
  display_name?: string
  email: string
  password: string
  username: string
}

export interface VerificationPending {
  email: string
  status: 'verification_pending'
}

// WordPress REST API User response format
interface WPUserResponse {
  avatar_urls: {
    '24': string
    '48': string
    '96': string
  }
  description: string
  email?: string
  id: number
  link: string
  name: string
  roles?: string[]
  slug: string
  url: string
}

/**
 * Convert WordPress REST API user response to our User format
 */
function wpUserToUser(wpUser: WPUserResponse, username?: string): User {
  const roles = wpUser.roles ?? []
  return {
    avatar: wpUser.avatar_urls['96'] || wpUser.avatar_urls['48'] || wpUser.avatar_urls['24'] || '',
    display_name: wpUser.name,
    email: wpUser.email || '',
    id: wpUser.id,
    role: roles[0] ?? undefined,
    roles,
    username: username || wpUser.slug
  }
}

// Auth endpoints that set the WordPress auth cookie also return a fresh
// `wp_rest` nonce. The page-load nonce was created for the logged-out visitor
// and stops working once we're authenticated, so we must refresh it.
type AuthUser = User & { nonce?: string }

/**
 * Pull the refreshed nonce out of an auth response (so subsequent requests stay
 * valid) and return the plain user payload.
 */
function consumeAuthUser(data: AuthUser): User {
  const { nonce, ...user } = data
  setNonce(nonce)
  return user
}

/**
 * Login user using WordPress default authentication
 */
export async function loginApi(payload: LoginPayload): Promise<ResponseType<User>> {
  try {
    const response = await post<LoginPayload, AuthUser>('auth/login', {
      body: payload
    })
    return { ...response, data: consumeAuthUser(response.data) }
  } catch (error) {
    console.error('Login API error:', error)
    throw error
  }
}

/**
 * Sign up new user using WordPress default user creation
 */
export async function signupApi(
  payload: SignupPayload
): Promise<ResponseType<User | VerificationPending>> {
  try {
    // Filter out undefined values to avoid validation errors
    const cleanPayload: SignupPayload = {
      email: payload.email,
      password: payload.password,
      username: payload.username
    }
    if (payload.display_name) {
      cleanPayload.display_name = payload.display_name
    }

    const response = await post<SignupPayload, AuthUser | VerificationPending>('auth/signup', {
      body: cleanPayload
    })
    // The auto-login branch returns a user + fresh nonce; verification_pending does not.
    if (response.data && 'nonce' in response.data) {
      return { ...response, data: consumeAuthUser(response.data) }
    }
    return response
  } catch (error) {
    console.error('Signup API error:', error)
    throw error
  }
}

/**
 * Get current authenticated user using WordPress default REST API endpoint
 * Falls back to custom endpoint if WordPress REST API is not available
 */
export async function getCurrentUserApi(): Promise<ResponseType<User>> {
  try {
    // Prefer custom endpoint to reliably include roles
    return await get<User>('auth/me')
  } catch {
    // Fallback to WordPress default REST API endpoint (/wp/v2/users/me)
    const response = await wpApi<never, WPUserResponse>('users/me', {
      method: 'GET'
    })
    return {
      ...response,
      data: wpUserToUser(response.data)
    }
  }
}

/**
 * Verify email address using the token from the verification email link
 */
export async function verifyEmailApi(token: string, userId?: number): Promise<ResponseType<User>> {
  const body: { token: string; user_id?: number } = { token }
  if (userId) body.user_id = userId
  const response = await post<{ token: string; user_id?: number }, AuthUser>('auth/verify-email', {
    body
  })
  return { ...response, data: consumeAuthUser(response.data) }
}

/**
 * Confirm a pending email address change.
 *
 * Unlike verifyEmailApi this does not sign anyone in — the member is already
 * signed in on the device that asked for the change, and the link may well be
 * opened somewhere else. No auth state changes, so no nonce comes back.
 */
export async function verifyEmailChangeApi(token: string, userId: number): Promise<ResponseType<User>> {
  return post<{ token: string; user_id: number }, User>('auth/verify-email-change', {
    body: { token, user_id: userId }
  })
}

/**
 * Send a password reset email
 */
export async function forgotPasswordApi(login: string): Promise<ResponseType<{ message: string }>> {
  return post<{ login: string }, { message: string }>('auth/forgot-password', { body: { login } })
}

/**
 * Logout user using WordPress default logout
 */
export async function logoutApi(): Promise<ResponseType<{ message: string }>> {
  return post<never, { message: string }>('auth/logout', {
    body: undefined
  })
}
