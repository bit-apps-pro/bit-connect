/**
 * Auto-resize pasted images to fit within WordPress media limits before upload.
 * Limits come from the `wpMediaSettings` server variable sent by BaseView.php.
 */
import config from '@config/config'

/**
 * Image types the server accepts — mirrors the image half of ALLOWED_TYPES in
 * attachment-validation.ts.
 */
const UPLOADABLE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

/** Extension to give the re-encoded file, keyed by the type the canvas wrote. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

function getMediaLimits(): { maxBytes: number; maxPx: number } {
  return {
    maxBytes: config.WP_MEDIA_SETTINGS.maxUploadBytes,
    maxPx: config.WP_MEDIA_SETTINGS.bigImageThresholdPx
  }
}

export interface ResizeResult {
  error?: string
  file: File
  wasResized: boolean
}

export async function resizeImageIfNeeded(file: File): Promise<ResizeResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Only image files can be pasted.', file, wasResized: false }
  }

  const { maxBytes, maxPx } = getMediaLimits()

  const objectUrl = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.addEventListener('load', () => resolve(element))
      element.onerror = () => reject(new Error('Could not read image'))
      element.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }

  const needsResize = img.naturalWidth > maxPx || img.naturalHeight > maxPx || file.size > maxBytes

  // A format the server will not take (AVIF, HEIC, BMP, TIFF…) is re-encoded
  // rather than rejected: the browser has already decoded it to draw it, so the
  // canvas can hand back a PNG. Copying an image from a site that serves AVIF is
  // ordinary, and refusing it reads as "pasting images is broken".
  const needsConversion = !UPLOADABLE_TYPES.has(file.type)

  if (!needsResize && !needsConversion) return { file, wasResized: false }

  const scale = Math.min(maxPx / img.naturalWidth, maxPx / img.naturalHeight, 1)
  const width = Math.round(img.naturalWidth * scale)
  const height = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

  // Oversized files become JPEG because that is what actually shrinks a photo;
  // everything else keeps its own type, or becomes PNG when that type cannot be
  // uploaded as-is.
  let outputType = file.type
  if (file.size > maxBytes) {
    outputType = 'image/jpeg'
  } else if (needsConversion) {
    outputType = 'image/png'
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image resize failed'))), outputType, 0.85)
  )

  // `toBlob` silently falls back to PNG for a type it cannot encode, so trust
  // the blob's own type over the one we asked for when naming the file.
  const finalType = blob.type || outputType
  const extension = EXTENSION_BY_TYPE[finalType] ?? 'png'
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'pasted-image'
  const resized = new File([blob], `${baseName}.${extension}`, { type: finalType })
  return { file: resized, wasResized: true }
}
