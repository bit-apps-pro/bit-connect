import queryRequest, { extractUploadError, uploadRequest } from '@common/helpers/request'
import { create } from 'zustand'

export const DEFAULT_MAX_ATTACHMENTS = 5

export interface WPAttachmentData {
  filename: string
  filesize: number
  id: number
  type: string
  url: string
}

export interface FileItem {
  file?: File
  file_id: string
  file_name: string
  file_size_in_bytes: number
  file_url: string
  isUploading?: boolean
  mime: string
  /** 0–100 while uploading. */
  progress?: number
  uploadError?: string
  wp_id?: number
  wp_url?: string
}

interface FileStore {
  addFiles: (files: FileItem[]) => void
  clearFiles: (savedIds?: number[]) => void
  files: FileItem[]
  maxAttachments: number
  removeFile: (id: string) => void
  resetFiles: () => void
  setFiles: (data: FileItem[]) => void
  setMaxAttachments: (max: number) => void
  uploadFile: (fileId: string) => Promise<undefined | WPAttachmentData>
}

const useFileStore = create<FileStore>((set, get) => ({
  addFiles: files =>
    set(state => {
      const remaining = state.maxAttachments - state.files.length
      const filesToAdd = files.slice(0, Math.max(0, remaining))
      return { files: [...state.files, ...filesToAdd] }
    }),
  clearFiles: (savedIds?: number[]) => {
    const { files } = get()
    const saved = savedIds ? new Set(savedIds) : new Set<number>()

    for (const file of files) {
      if (file.wp_id && !saved.has(file.wp_id)) {
        queryRequest('attachments/delete', { id: file.wp_id })
      }
    }

    set({ files: [] })
  },
  files: [],
  maxAttachments: DEFAULT_MAX_ATTACHMENTS,
  removeFile: id => {
    const file = get().files.find(f => f.file_id === id)

    if (file?.wp_id) {
      queryRequest('attachments/delete', { id: file.wp_id })
    }

    set(state => ({
      files: state.files.filter(f => f.file_id !== id)
    }))
  },
  resetFiles: () => set({ files: [] }),
  setFiles: data =>
    set(() => ({
      files: data
    })),
  setMaxAttachments: max => set({ maxAttachments: max }),
  uploadFile: async (fileId: string) => {
    const file = get().files.find(f => f.file_id === fileId)
    if (!file?.file) return

    const patch = (changes: Partial<FileItem>) =>
      set(state => ({
        files: state.files.map(f => (f.file_id === fileId ? { ...f, ...changes } : f))
      }))

    patch({ isUploading: true, progress: 0, uploadError: undefined })

    try {
      const formData = new FormData()
      formData.append('file', file.file)

      const response = await uploadRequest<WPAttachmentData>('attachments', formData, {
        onProgress: percent => patch({ progress: percent })
      })
      const attachment = response.data

      patch({
        isUploading: false,
        progress: undefined,
        wp_id: attachment.id,
        wp_url: attachment.url
      })

      return attachment
    } catch (error) {
      patch({
        isUploading: false,
        progress: undefined,
        uploadError: extractUploadError(error)
      })
      return
    }
  }
}))

export default useFileStore
