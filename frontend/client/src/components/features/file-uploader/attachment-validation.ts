/**
 * Client-side attachment validation.
 *
 * This runs BEFORE the file reaches the server.  It is a UX layer — it gives
 * instant feedback and avoids wasting bandwidth on obviously bad files.
 * Backend validation (AttachmentValidatorService.php) is the final authority.
 *
 * Security note: MIME types reported by the browser (file.type) are
 * unreliable — they come from the OS file-type registry, not from reading
 * the file's bytes.  We validate the extension AND the reported MIME type
 * together.  The backend re-validates via magic bytes regardless.
 */

import { __, sprintf } from '@common/helpers/i18nWrap'
import config, { type FileKind } from '@config/config'

// ---------------------------------------------------------------------------
// Allowed types
// ---------------------------------------------------------------------------

/**
 * The plugin's own list, extension → MIME types the browser may report.
 *
 * Used only where the page sent none — the SSR prerender, tests. Everywhere
 * else the list is the server's own (AttachmentValidatorService::attachmentTypes()),
 * so what this accepts is what the server accepts, including anything another
 * plugin added. Mirrors AttachmentValidatorService::ALLOWED.
 */
const OWN_TYPES: Record<string, string[]> = {
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  gif: ['image/gif'],
  jpeg: ['image/jpeg'],
  jpg: ['image/jpeg'],
  pdf: ['application/pdf'],
  png: ['image/png'],
  webp: ['image/webp']
}

/**
 * MIME names some browsers report that the server never reads a file as. The
 * server checks the bytes; this only keeps a browser's own spelling from
 * refusing a file the server would take.
 */
const REPORTED_ALIASES: Record<string, string[]> = {
  'image/jpeg': ['image/jpg']
}

/** Read per call so a test can change the config between cases. */
const allowedTypes = () => config.ATTACHMENT_TYPES ?? OWN_TYPES

const reportedMimesOf = (extension: string) =>
  (allowedTypes()[extension] ?? []).flatMap(mime => [mime, ...(REPORTED_ALIASES[mime] ?? [])])

/**
 * The per-file cap the server enforces for a kind of file
 * (PostingLimits::maxFileSizeFor()), sent with the page; with no kind, the
 * largest of them. Read per call so a test can change the config between cases.
 */
export const maxFileSizeBytes = (kind?: FileKind) => {
  const byKind = config.POSTING_LIMITS.maxFileSizeByKind
  return kind ? byKind[kind] : Math.max(...Object.values(byKind))
}

/**
 * Which kind of file this is, for its size limit and its count. Read from the
 * types the server lists for its extension, so it agrees with how the server
 * will read the bytes; the browser's own report is the fallback.
 */
export function fileKindOf(name: string, mime = ''): FileKind {
  const listed = allowedTypes()[getExtension(name)]?.[0] ?? mime
  const family = listed.toLowerCase().split('/')[0]
  return family === 'image' || family === 'video' ? family : 'document'
}

/** What a post may still take: attached files and videos are counted apart. */
interface CountLimits {
  attachments: number
  videos: number
}

/**
 * Why one more file will not fit beside the ones already chosen, or undefined
 * when it will. A video counts against the videos limit and anything else
 * against the files limit, as PostingLimits::assertWithin() counts them.
 */
export function noRoomFor(
  file: { name: string; type?: string },
  chosen: { mime?: string; name: string }[],
  limits: CountLimits
): string | undefined {
  const isVideo = fileKindOf(file.name, file.type) === 'video'
  const sameKind = chosen.filter(item => (fileKindOf(item.name, item.mime) === 'video') === isVideo).length
  const limit = isVideo ? limits.videos : limits.attachments

  if (sameKind < limit) return undefined
  if (limit === 0) return isVideo ? __('Videos cannot be added here.') : __('Files cannot be attached here.')
  if (limit === 1) return isVideo ? __('You can add only 1 video.') : __('You can attach only 1 file.')
  return sprintf(isVideo ? __('You can add up to %s videos.') : __('You can attach up to %s files.'), String(limit))
}

/** Whether any listed type is a video, so offering to add one makes sense. */
export const acceptsVideo = () =>
  Object.values(allowedTypes()).some(mimes => mimes.some(mime => mime.startsWith('video/')))

/** "5 MB", "1.5 MB" — one decimal only when the cap is not whole megabytes. */
export const formatMegabytes = (bytes: number) => `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`

/** Extensions that must never be accepted regardless of MIME type */
const DANGEROUS_EXTENSIONS = new Set([
  'bash',
  'bat',
  'cmd',
  'com',
  'exe',
  'htaccess',
  'htm',
  'html',
  'htpasswd',
  'js',
  'jsx',
  'msi',
  'phar',
  'php',
  'php3',
  'php4',
  'php5',
  'php7',
  'phtml',
  'pl',
  'py',
  'rb',
  'sh',
  'svg',
  'ts',
  'tsx',
  'xml'
])

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface AttachmentValidationResult {
  error?: string
  valid: boolean
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Validate a File object before queuing it for upload.
 * Returns immediately — no async I/O.
 */
export function validateAttachment(file: File): AttachmentValidationResult {
  // 1. File size
  if (file.size === 0) {
    return { error: 'File is empty.', valid: false }
  }

  const maxBytes = maxFileSizeBytes(fileKindOf(file.name, file.type))
  if (file.size > maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      error: `File is too large (${mb} MB). Maximum allowed size is ${formatMegabytes(maxBytes)}.`,
      valid: false
    }
  }

  // 2. Extract and normalise the extension from the filename
  const extension = getExtension(file.name)

  if (!extension) {
    return { error: 'File must have an extension (e.g. photo.jpg).', valid: false }
  }

  // 3. Block dangerous extensions unconditionally — even if MIME looks safe
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    return { error: `Files with the .${extension} extension are not allowed.`, valid: false }
  }

  // 4. Double-extension check: e.g. "shell.php.jpg"
  //    Reject if ANY secondary extension is dangerous
  const parts = file.name.toLowerCase().split('.')
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      if (DANGEROUS_EXTENSIONS.has(parts[i])) {
        return {
          error: `File name contains a disallowed extension (.${parts[i]}).`,
          valid: false
        }
      }
    }
  }

  // 5. Check extension against allowed list
  const allowedMimes = reportedMimesOf(extension)
  if (allowedMimes.length === 0) {
    const allowed = Object.keys(allowedTypes()).join(', ')
    return {
      error: `File type .${extension} is not allowed. Allowed types: ${allowed}.`,
      valid: false
    }
  }

  // 6. Cross-check browser-reported MIME against the extension's expected MIMEs
  //    An empty file.type is OK — some browsers don't set it for all types
  if (file.type && !allowedMimes.includes(file.type.toLowerCase())) {
    return {
      error: `File content does not match its extension (.${extension}).`,
      valid: false
    }
  }

  // 7. Filename length — WordPress truncates long names which can cause confusion
  if (file.name.length > 255) {
    return { error: 'File name is too long (maximum 255 characters).', valid: false }
  }

  return { valid: true }
}

/**
 * Antd Upload `accept` prop value — a comma-separated list of MIME types.
 */
export function acceptMimeTypes(kind?: FileKind): string {
  // Extensions as well as MIME types: a picker filtering on MIME alone hides
  // files the OS has no type registered for, which is common outside the
  // everyday image and document formats.
  const accepted = new Set<string>()
  for (const extension of Object.keys(allowedTypes())) {
    // Only one kind, when asked for one: the picker behind "Upload video"
    // should offer the video formats the forum takes and nothing else.
    if (kind && fileKindOf(`x.${extension}`) !== kind) continue
    accepted.add(`.${extension}`)
    for (const mime of reportedMimesOf(extension)) accepted.add(mime)
  }
  return [...accepted].join(',')
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}
