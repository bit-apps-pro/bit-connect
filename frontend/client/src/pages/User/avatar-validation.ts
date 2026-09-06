/**
 * Client-side profile picture checks.
 *
 * Purely for fast feedback — a file picked in the browser can be rejected
 * before a byte is uploaded. None of this is a security control: the server
 * re-validates from the file's magic bytes in AttachmentValidatorService and
 * narrows to images in UploadAvatarRequest, and that is the check that counts.
 *
 * Kept in sync with AvatarService::ALLOWED_MIMES and the validator's 5 MB cap.
 */

/** Accepted image MIME types. Mirrors AvatarService::ALLOWED_MIMES. */
export const AVATAR_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** `accept` attribute for the file input. */
export const AVATAR_ACCEPT = AVATAR_MIMES.join(',')

/** Mirrors AttachmentValidatorService::MAX_FILE_SIZE. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/**
 * @returns an error message, or undefined when the file looks acceptable
 */
export function validateAvatarFile(file: File): string | undefined {
  if (!AVATAR_MIMES.includes(file.type)) {
    return 'Profile pictures must be a JPG, PNG, GIF or WebP image.'
  }

  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return `Image is too large (${mb} MB). Maximum allowed size is 5 MB.`
  }

  if (file.size === 0) {
    return 'That image is empty.'
  }

  return undefined
}
