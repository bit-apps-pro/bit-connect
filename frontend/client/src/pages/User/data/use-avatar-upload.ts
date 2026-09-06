import queryRequest, { extractUploadError, uploadRequest } from '@common/helpers/request'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { useAuthStore } from '@/store/auth.zustand'

import { AVATAR_ACCEPT, validateAvatarFile } from '../avatar-validation'

interface AvatarResponse {
  avatar: string
  id?: number
}

/**
 * Upload and removal of the signed-in member's profile picture.
 *
 * Progress comes from `uploadRequest` (XHR) rather than fetch, which cannot
 * observe how much of a request body has been sent. The client-side check in
 * validateAvatarFile is a courtesy for fast feedback — the server re-validates
 * from magic bytes and is the only check that counts.
 */
export default function useAvatarUpload(userId: number | string | undefined) {
  const queryClient = useQueryClient()
  const { checkAuth } = useAuthStore()
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const id = Number(userId)

  /** Refresh everything that renders this member's picture. */
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-profile', id] })
    // Topic and comment lists embed the avatar URL in their payloads, so they
    // keep showing the old picture until refetched.
    await queryClient.invalidateQueries({ queryKey: ['user-content'] })
    // The header avatar comes from the auth store, not TanStack Query, so
    // invalidating queries alone would leave it showing the old picture until
    // the next full page load.
    await checkAuth()
  }

  /**
   * @returns an error message, or undefined on success
   */
  const upload = async (file: File): Promise<string | undefined> => {
    const clientError = validateAvatarFile(file)
    if (clientError) return clientError

    const body = new FormData()
    body.append('file', file)

    setProgress(0)
    setIsUploading(true)

    try {
      await uploadRequest<AvatarResponse>(`users/${id}/avatar`, body, {
        onProgress: setProgress
      })
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
      await queryRequest<AvatarResponse>(`users/${id}/avatar/remove`, {}, undefined, 'POST')
      await invalidate()
      return undefined
    } catch (error) {
      return extractUploadError(error)
    } finally {
      setIsRemoving(false)
    }
  }

  return { accept: AVATAR_ACCEPT, isRemoving, isUploading, progress, remove, upload }
}
