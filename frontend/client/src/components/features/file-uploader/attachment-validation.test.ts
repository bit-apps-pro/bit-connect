import config from '@config/config'
import { afterEach, describe, expect, it } from 'vitest'

import { acceptMimeTypes, noRoomFor, validateAttachment } from './attachment-validation'

// The config is read-only to the app; a test stands in for the page by writing it.
const page = config as { ATTACHMENT_TYPES?: Record<string, string[]>; POSTING_LIMITS: typeof config.POSTING_LIMITS }
const originalLimits = config.POSTING_LIMITS

const file = (name: string, type: string) => new File(['bytes'], name, { type })
const big = (name: string, type: string) => new File(['x'.repeat(100)], name, { type })

afterEach(() => {
  page.ATTACHMENT_TYPES = undefined
  page.POSTING_LIMITS = originalLimits
})

describe('the attachment check without a page', () => {
  it('accepts the plugin’s own images and documents', () => {
    expect(validateAttachment(file('photo.jpg', 'image/jpeg')).valid).toBe(true)
    expect(validateAttachment(file('brief.pdf', 'application/pdf')).valid).toBe(true)
  })

  it('accepts the browser’s own spelling of a JPEG', () => {
    expect(validateAttachment(file('photo.jpeg', 'image/jpg')).valid).toBe(true)
  })

  it('refuses a type not on the list', () => {
    expect(validateAttachment(file('archive.zip', 'application/zip')).error).toMatch(/\.zip is not allowed/)
  })
})

describe('the attachment check with the server’s list', () => {
  it('accepts a type the server added', () => {
    page.ATTACHMENT_TYPES = { mp4: ['video/mp4'], png: ['image/png'] }

    expect(validateAttachment(file('clip.mp4', 'video/mp4')).valid).toBe(true)
  })

  it('refuses a type the server took away', () => {
    page.ATTACHMENT_TYPES = { png: ['image/png'] }

    expect(validateAttachment(file('brief.pdf', 'application/pdf')).error).toBe(
      'File type .pdf is not allowed. Allowed types: png.'
    )
  })

  it('still refuses a file whose reported type contradicts its extension', () => {
    page.ATTACHMENT_TYPES = { mp4: ['video/mp4'] }

    expect(validateAttachment(file('clip.mp4', 'application/pdf')).valid).toBe(false)
  })

  it('still refuses a dangerous extension the server listed', () => {
    page.ATTACHMENT_TYPES = { php: ['text/plain'] }

    expect(validateAttachment(file('shell.php', 'text/plain')).valid).toBe(false)
  })

  it('counts videos apart from other files', () => {
    page.ATTACHMENT_TYPES = { mp4: ['video/mp4'], pdf: ['application/pdf'] }
    const chosen = [
      { mime: 'video/mp4', name: 'a.mp4' },
      { mime: 'application/pdf', name: 'b.pdf' }
    ]
    const limits = { attachments: 2, videos: 1 }

    expect(noRoomFor({ name: 'c.pdf' }, chosen, limits)).toBeUndefined()
    expect(noRoomFor({ name: 'd.mp4' }, chosen, limits)).toBe('You can add only 1 video.')
    expect(noRoomFor({ name: 'd.mp4' }, [], { attachments: 5, videos: 0 })).toBe('Videos cannot be added here.')
  })

  it('holds each kind of file to its own size', () => {
    page.ATTACHMENT_TYPES = { mp4: ['video/mp4'], png: ['image/png'] }
    page.POSTING_LIMITS = {
      ...originalLimits,
      maxFileSizeByKind: { document: 10, image: 10, video: 1000 }
    }

    expect(validateAttachment(big('clip.mp4', 'video/mp4')).valid).toBe(true)
    expect(validateAttachment(big('shot.png', 'image/png')).error).toMatch(/too large/)
  })

  it('offers the picker each extension as well as its types', () => {
    page.ATTACHMENT_TYPES = { jpg: ['image/jpeg'], mp4: ['video/mp4'] }

    expect(acceptMimeTypes().split(',')).toEqual(['.jpg', 'image/jpeg', 'image/jpg', '.mp4', 'video/mp4'])
  })
})
