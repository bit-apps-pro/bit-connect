/**
 * Client-side cover image checks.
 *
 * The limits are the avatar's, and deliberately imported rather than restated:
 * both uploads land in AttachmentValidatorService, so the same 5 MB cap and the
 * same image types apply. Only the wording differs, because "profile picture" is
 * the wrong noun when someone is picking a banner.
 *
 * As with the avatar, none of this is a security control — the server
 * re-validates from magic bytes in UploadCoverRequest, and that is the check
 * that counts.
 */

import { AVATAR_MAX_BYTES, AVATAR_MIMES } from './avatar-validation'

/** `accept` attribute for the file input. */
export const COVER_ACCEPT = AVATAR_MIMES.join(',')

export const COVER_MAX_BYTES = AVATAR_MAX_BYTES

/**
 * @returns an error message, or undefined when the file looks acceptable
 */
export function validateCoverFile(file: File): string | undefined {
  if (!AVATAR_MIMES.includes(file.type)) {
    return 'Cover images must be a JPG, PNG, GIF or WebP image.'
  }

  if (file.size > COVER_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image is too large (${mb} MB). Maximum allowed size is 5 MB.`
  }

  if (file.size === 0) {
    return 'That image is empty.'
  }

  return undefined
}
