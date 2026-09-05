import { __ } from '@common/helpers/i18nWrap'

import { type AuthSettingsFormData } from './types'

/**
 * Custom-URL mode only works when the login page it points at is reachable, so
 * both the settings screen and the onboarding wizard have to apply the same
 * rule — the server enforces it too, and a mismatch is how blank auth settings
 * used to get saved.
 *
 * The registration URL is optional: a combined login/registration page is the
 * common setup, and the portal falls back to the login page for sign-ups.
 *
 * @returns an error message, or undefined when the form can be saved
 */
type AuthUrlFields = Pick<AuthSettingsFormData, 'customLoginUrl' | 'customRegistrationUrl' | 'mode'>

export function validateAuthForm(form: AuthUrlFields): string | undefined {
  if (form.mode !== 'custom_url') return undefined

  if (!isAbsoluteUrl(form.customLoginUrl)) {
    return __('Please enter a valid Custom Login Page URL, for example https://example.com/login')
  }

  if (form.customRegistrationUrl?.trim() && !isAbsoluteUrl(form.customRegistrationUrl)) {
    return __(
      'Please enter a valid Custom Registration Page URL, for example https://example.com/register'
    )
  }

  return undefined
}

/** http(s) URL with a host — anything else cannot be redirected to. */
function isAbsoluteUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false

  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && url.hostname !== ''
  } catch {
    return false
  }
}
