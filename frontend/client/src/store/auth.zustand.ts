import config from '@config/config'
import { create } from 'zustand'

import {
  getCurrentUserApi,
  loginApi,
  type LoginPayload,
  logoutApi,
  signupApi,
  type SignupPayload,
  type User
} from './data/auth-api'
import {
  capabilitiesOf,
  type CapabilityMap,
  type ForumCapability,
  hasCapability
} from './helper/capabilities'

/**
 * Extract error message from error response
 * Handles validation errors (code: "VALIDATION") and general errors
 */
function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred'
  }

  // Check if it's a validation error response
  if ('code' in error && error.code === 'VALIDATION' && 'data' in error) {
    const validationData = error.data
    if (validationData && typeof validationData === 'object') {
      // Format validation errors: "Field name: error message"
      const errors = Object.entries(validationData)
        .map(([field, messages]) => {
          const fieldName = field.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())
          const messageArray = Array.isArray(messages) ? messages : [String(messages)]
          return `${fieldName}: ${messageArray.join(', ')}`
        })
        .join('; ')
      return errors || 'Validation failed'
    }
  }

  // Check for general error message in data
  if ('data' in error) {
    const errorData = error.data
    if (typeof errorData === 'string') {
      return errorData
    }
    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      return String(errorData.message)
    }
  }

  // Check for message field
  if ('message' in error) {
    return String(error.message)
  }

  // Check for errors field (legacy format)
  if ('errors' in error) {
    return String(error.errors)
  }

  return 'An unexpected error occurred'
}

interface AuthStore {
  /**
   * Whether the signed-in member holds a forum capability. Use this to gate any
   * control whose action the REST layer checks — never the role name, which
   * says nothing about what Manager granted that role.
   */
  can: (capability: ForumCapability) => boolean
  capabilities: CapabilityMap
  checkAuth: () => Promise<void>
  error: string | undefined
  isLoading: boolean
  isLoggedIn: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  pendingVerificationEmail: string | undefined
  setError: (error: string | undefined) => void
  setLoading: (isLoading: boolean) => void
  setPendingVerificationEmail: (email: string | undefined) => void
  setUser: (user: undefined | User) => void
  signup: (payload: SignupPayload) => Promise<void>
  user: undefined | User
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const initialUser = config.CURRENT_USER
    ? {
        ...config.CURRENT_USER,
        role: config.CURRENT_USER.role ?? undefined,
        roles: config.CURRENT_USER.roles ?? []
      }
    : undefined

  return {
    capabilities: capabilitiesOf(initialUser),
    error: undefined,
    isLoading: false,
    isLoggedIn: config.IS_LOGGED_IN,
    pendingVerificationEmail: undefined,
    user: initialUser,

    can: capability => hasCapability(get().capabilities, capability),

    checkAuth: async () => {
      set({ error: undefined, isLoading: true })
      try {
        const response = await getCurrentUserApi()
        if (response.data) {
          set({
            capabilities: capabilitiesOf(response.data),
            isLoading: false,
            isLoggedIn: true,
            user: response.data
          })
        } else {
          set({
            capabilities: {},
            isLoading: false,
            isLoggedIn: false,
            user: undefined
          })
        }
      } catch {
        // User is not authenticated
        set({
          capabilities: {},
          error: undefined, // Don't show error for unauthenticated users
          isLoading: false,
          isLoggedIn: false,
          user: undefined
        })
      }
    },

    login: async (payload: LoginPayload) => {
      set({ error: undefined, isLoading: true })
      try {
        const response = await loginApi(payload)
        if (response.data) {
          set({
            capabilities: capabilitiesOf(response.data),
            isLoading: false,
            isLoggedIn: true,
            user: response.data
          })
        } else {
          throw new Error('Login failed: No user data returned')
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        set({ error: errorMessage, isLoading: false })
        throw error
      }
    },

    logout: async () => {
      set({ error: undefined, isLoading: true })
      try {
        await logoutApi()
        set({
          capabilities: {},
          isLoading: false,
          isLoggedIn: false,
          user: undefined
        })
        // Reload page to clear all state
        window.location.reload()
      } catch (error) {
        const errorMessage = (error as Error).message || 'Logout failed'
        set({ error: errorMessage, isLoading: false })
        // Still clear user state even if API call fails
        set({
          capabilities: {},
          isLoggedIn: false,
          user: undefined
        })
        window.location.reload()
      }
    },

    signup: async (payload: SignupPayload) => {
      set({ error: undefined, isLoading: true })
      try {
        const response = await signupApi(payload)
        if (
          response.data &&
          'status' in response.data &&
          response.data.status === 'verification_pending'
        ) {
          set({ isLoading: false, pendingVerificationEmail: response.data.email })
        } else if (response.data && 'id' in response.data) {
          set({
            capabilities: capabilitiesOf(response.data),
            isLoading: false,
            isLoggedIn: true,
            user: response.data
          })
        } else {
          throw new Error('Signup failed: No user data returned')
        }
      } catch (error) {
        const errorMessage = extractErrorMessage(error)
        set({ error: errorMessage, isLoading: false })
        throw error
      }
    },

    setError: error => set({ error }),
    setLoading: isLoading => set({ isLoading }),
    setPendingVerificationEmail: email => set({ pendingVerificationEmail: email }),
    setUser: user => set({ capabilities: capabilitiesOf(user), isLoggedIn: !!user, user })
  }
})
