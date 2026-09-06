import queryRequest, { extractUploadError, uploadRequest } from '@common/helpers/request'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { COVER_ACCEPT, validateCoverFile } from '../cover-validation'

interface CoverResponse {
  cover: null | string
  id?: number
}

/**
 * Upload and removal of the signed-in member's cover image.
 *
 * Shaped like useAvatarUpload — XHR for progress, errors returned rather than
 * thrown — but with no checkAuth() call: the cover appears only on the profile
 * card, never in the header, so the auth store has nothing to refresh.
 */
export default function useCoverUpload(userId: number | string | undefined) {
  const queryClient = useQueryClient()
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const id = Number(userId)

  /**
   * Keyed on the prefix with no identifier. The profile query is keyed by the
   * URL slug, so invalidating `['user-profile', id]` with a numeric id would
   * never match the cached `['user-profile', 'aiden-carter']`.
   */
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-profile'] })
  }

  /**
   * @returns an error message, or undefined on success
   */
  const upload = async (file: File): Promise<string | undefined> => {
    const clientError = validateCoverFile(file)
    if (clientError) return clientError

    const body = new FormData()
    body.append('file', file)

    setProgress(0)
    setIsUploading(true)

    try {
      await uploadRequest<CoverResponse>(`users/${id}/cover`, body, { onProgress: setProgress })
      await invalidate()
      return undefined
    } catch (error) {
      return extractUploadError(error)
    } finally {
      setIsUploading(false)
      setProgress(0)
    }
  }

  /**
   * @returns an error message, or undefined on success
   */
  const remove = async (): Promise<string | undefined> => {
    setIsRemoving(true)

    try {
      await queryRequest<CoverResponse>(`users/${id}/cover/remove`, {}, undefined, 'POST')
      await invalidate()
      return undefined
    } catch (error) {
      return extractUploadError(error)
    } finally {
      setIsRemoving(false)
    }
  }

  return { accept: COVER_ACCEPT, isRemoving, isUploading, progress, remove, upload }
}
