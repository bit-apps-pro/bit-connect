import { describe, expect, it } from 'vitest'

import { AVATAR_ACCEPT, AVATAR_MAX_BYTES, AVATAR_MIMES, validateAvatarFile } from './avatar-validation'
import { COVER_ACCEPT, COVER_MAX_BYTES, validateCoverFile } from './cover-validation'

/** A File of a given type and size, without allocating the bytes. */
function file(type: string, bytes: number): File {
  const picked = new File(['x'], 'picture.jpg', { type })

  Object.defineProperty(picked, 'size', { value: bytes })

  return picked
}

// Purely for fast feedback — a file picked in the browser can be rejected
// before a byte is uploaded. None of this is a security control: the server
// re-validates from magic bytes, and that is the check that counts. What these
// tests protect is the agreement with the server, so the browser never accepts
// something the upload will throw away.
describe('picking a profile picture', () => {
  it('accepts every image type the server does', () => {
    for (const type of AVATAR_MIMES) {
      expect(validateAvatarFile(file(type, 1024))).toBeUndefined()
    }
  })

  it('refuses a type the server would reject anyway', () => {
    expect(validateAvatarFile(file('application/pdf', 1024))).toMatch(/JPG, PNG, GIF or WebP/)
    expect(validateAvatarFile(file('image/svg+xml', 1024))).toMatch(/JPG, PNG, GIF or WebP/)
    expect(validateAvatarFile(file('', 1024))).toMatch(/JPG, PNG, GIF or WebP/)
  })

  it('refuses a file over the server’s cap and says how big it was', () => {
    const message = validateAvatarFile(file('image/png', AVATAR_MAX_BYTES + 1))

    expect(message).toMatch(/Image is too large \(5\.0 MB\)/)
    expect(message).toMatch(/Maximum allowed size is 5 MB/)
  })

  it('accepts a file exactly at the cap', () => {
    expect(validateAvatarFile(file('image/png', AVATAR_MAX_BYTES))).toBeUndefined()
  })

  it('refuses an empty file', () => {
    expect(validateAvatarFile(file('image/png', 0))).toBe('That image is empty.')
  })

  // Mirrors AttachmentValidatorService::MAX_FILE_SIZE; a limit that drifts
  // apart shows up as a file the browser accepts and the server throws away.
  it('caps at the same five megabytes the server does', () => {
    expect(AVATAR_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('offers the file picker exactly the types it accepts', () => {
    expect(AVATAR_ACCEPT).toBe(AVATAR_MIMES.join(','))
  })
})

// The limits are the avatar's, deliberately shared rather than restated: both
// uploads land in the same server-side validator. Only the wording differs,
// because "profile picture" is the wrong noun when picking a banner.
describe('picking a cover image', () => {
  it('accepts the same types as a profile picture', () => {
    for (const type of AVATAR_MIMES) {
      expect(validateCoverFile(file(type, 1024))).toBeUndefined()
    }
  })

  it('calls it a cover image rather than a profile picture', () => {
    expect(validateCoverFile(file('application/pdf', 1024))).toMatch(/^Cover images must be/)
  })

  it('holds to the same size cap', () => {
    expect(COVER_MAX_BYTES).toBe(AVATAR_MAX_BYTES)
    expect(validateCoverFile(file('image/png', COVER_MAX_BYTES + 1))).toMatch(/too large/)
    expect(validateCoverFile(file('image/png', COVER_MAX_BYTES))).toBeUndefined()
  })

  it('refuses an empty file', () => {
    expect(validateCoverFile(file('image/png', 0))).toBe('That image is empty.')
  })

  it('offers the same types to the file picker', () => {
    expect(COVER_ACCEPT).toBe(AVATAR_ACCEPT)
  })
})
