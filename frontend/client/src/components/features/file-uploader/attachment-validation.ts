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

import { __ } from '@common/helpers/i18nWrap'

// ---------------------------------------------------------------------------
// Allowed types — must stay in sync with AttachmentValidatorService::ALLOWED
// ---------------------------------------------------------------------------

interface AllowedType {
  /** Human-readable label shown in error messages */
  label: string
  /** MIME types the browser may report for this extension */
  mimes: string[]
}

const ALLOWED_TYPES: Record<string, AllowedType> = {
  doc: { label: __('Word document'), mimes: ['application/msword'] },
  docx: {
    label: __('Word document'),
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  gif: { label: __('GIF image'), mimes: ['image/gif'] },
  jpeg: { label: __('JPEG image'), mimes: ['image/jpeg', 'image/jpg'] },
  jpg: { label: __('JPEG image'), mimes: ['image/jpeg', 'image/jpg'] },
  pdf: { label: __('PDF document'), mimes: ['application/pdf'] },
  png: { label: __('PNG image'), mimes: ['image/png'] },
  webp: { label: __('WebP image'), mimes: ['image/webp'] }
}

/** 5 MB — must match AttachmentValidatorService::MAX_FILE_SIZE */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

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

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { error: `File is too large (${mb} MB). Maximum allowed size is 5 MB.`, valid: false }
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
  const allowedType = ALLOWED_TYPES[extension]
  if (!allowedType) {
    const allowed = Object.keys(ALLOWED_TYPES).join(', ')
    return {
      error: `File type .${extension} is not allowed. Allowed types: ${allowed}.`,
      valid: false
    }
  }

  // 6. Cross-check browser-reported MIME against the extension's expected MIMEs
  //    An empty file.type is OK — some browsers don't set it for all types
  if (file.type && !allowedType.mimes.includes(file.type.toLowerCase())) {
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
export function acceptMimeTypes(): string {
  const mimes = new Set<string>()
  for (const type of Object.values(ALLOWED_TYPES)) {
    for (const mime of type.mimes) {
      mimes.add(mime)
    }
  }
  return [...mimes].join(',')
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}
