import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileOutlined,
  FilePdfOutlined,
  LoadingOutlined,
  SendOutlined
} from '@ant-design/icons'
import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import queryRequest, { extractUploadError, uploadRequest } from '@common/helpers/request'
import { notificationOptions } from '@common/hooks/useNotificationConfig'
import { validateAttachment } from '@components/features/file-uploader/attachment-validation'
import QuillEditor from '@components/quilTextEditor'
import {
  COMMENT_LIMITS,
  formatCommentForWordPress,
  getCommentPlainTextLength
} from '@components/quilTextEditor/quill-comment-formatter'
import { resizeImageIfNeeded } from '@components/quilTextEditor/quill-image-resizer'
import { type WPAttachmentData } from '@features/file-uploader/state/use-file-store'
import { Button, List, Progress, Space, Typography } from 'antd'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'

import useLoginWarningStore from '@/components/features/login-warning-modal/state/use-login-warning-store'
import { useAuthStore } from '@/store/auth.zustand'

import styles from './CommentEditor.module.css'

interface LocalFileItem {
  file?: File
  fileId: string
  fileName: string
  fileSizeInBytes: number
  fileUrl: string
  isInitial?: boolean
  isUploading?: boolean
  mime: string
  /** 0–100 while uploading. */
  progress?: number
  uploadError?: string
  wpId?: number
  wpUrl?: string
}

interface CommentEditorProps {
  initialAttachments?: WPAttachmentData[]
  initialContent?: string
  maxAttachments?: number
  onCancel?: () => void
  onSubmit?: (content: string, attachments?: WPAttachmentData[]) => void
  placeholder?: string
  replyTo?: string
  submitButtonText?: string
}

const MAX_ATTACHMENTS_DEFAULT = 5

const generateFileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FileAvatar = ({ file }: { file: LocalFileItem }) => {
  if (file.mime.startsWith('image/')) {
    return (
      <img
        alt={file.fileName}
        src={file.wpUrl || file.fileUrl}
        style={{ borderRadius: 4, height: 50, objectFit: 'cover', width: 50 }}
      />
    )
  }

  if (file.mime === 'application/pdf') {
    return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 32 }} />
  }

  return <FileOutlined style={{ fontSize: 32 }} />
}

const UploadStatus = ({ file }: { file: LocalFileItem }) => {
  if (file.isUploading) {
    // Percent comes from the request's own progress events. Until the first one
    // arrives the bar shows 0 rather than guessing, and the spinner covers the
    // gap; `active` keeps it animating while the server processes the last byte.
    const percent = file.progress ?? 0
    return (
      <Space className="bc-w-full bc-text-blue-500" size="small">
        <LoadingOutlined />
        <span className="bc-whitespace-nowrap">
          {percent >= 100 ? __('Processing…') : `${__('Uploading')} ${percent}%`}
        </span>
        <Progress
          className="bc-m-0 bc-w-24"
          percent={percent}
          showInfo={false}
          size="small"
          status="active"
        />
      </Space>
    )
  }

  if (file.uploadError) {
    return (
      <Space className="bc-text-red-500" size="small">
        <CloseCircleOutlined />
        <span>{file.uploadError}</span>
      </Space>
    )
  }

  if (file.wpId) {
    return (
      <Space className="bc-text-green-600" size="small">
        <CheckCircleOutlined />
        <span>Uploaded</span>
      </Space>
    )
  }

  return
}

const toLocalFileItems = (attachments?: WPAttachmentData[]): LocalFileItem[] =>
  attachments?.map(att => ({
    fileId: `initial-${att.id}`,
    fileName: att.filename,
    fileSizeInBytes: att.filesize,
    fileUrl: att.url,
    isInitial: true,
    mime: att.type,
    wpId: att.id,
    wpUrl: att.url
  })) ?? []

export default function CommentEditor({
  initialAttachments,
  initialContent,
  maxAttachments = MAX_ATTACHMENTS_DEFAULT,
  onCancel,
  onSubmit,
  placeholder = 'Write comment here...',
  replyTo,
  submitButtonText
}: CommentEditorProps) {
  const { isLoggedIn } = useAuthStore()
  const { open: openLoginWarning } = useLoginWarningStore()
  const { notificationApi } = useContext(NotifyContext)
  const [key, setKey] = useState(0)
  const [files, setFiles] = useState<LocalFileItem[]>(() => toLocalFileItems(initialAttachments))
  const filesRef = useRef(files)
  const onSubmitRef = useRef(onSubmit)
  filesRef.current = files
  onSubmitRef.current = onSubmit

  const isUploading = files.some(f => f.isUploading)

  const uploadFile = useCallback(async (fileItem: LocalFileItem) => {
    if (!fileItem.file) return

    setFiles(prev =>
      prev.map(f =>
        f.fileId === fileItem.fileId
          ? { ...f, isUploading: true, progress: 0, uploadError: undefined }
          : f
      )
    )

    try {
      const formData = new FormData()
      formData.append('file', fileItem.file)

      const response = await uploadRequest<WPAttachmentData>('attachments', formData, {
        onProgress: percent =>
          setFiles(prev =>
            prev.map(f => (f.fileId === fileItem.fileId ? { ...f, progress: percent } : f))
          )
      })
      const attachment = response.data

      setFiles(prev =>
        prev.map(f =>
          f.fileId === fileItem.fileId
            ? {
                ...f,
                isUploading: false,
                progress: undefined,
                wpId: attachment.id,
                wpUrl: attachment.url
              }
            : f
        )
      )
    } catch (error) {
      const message = extractUploadError(error)
      setFiles(prev =>
        prev.map(f =>
          f.fileId === fileItem.fileId
            ? { ...f, isUploading: false, progress: undefined, uploadError: message }
            : f
        )
      )
    }
  }, [])

  const handleImagePaste = useCallback(
    async (file: File, insertImage: (url: string) => void, onProgress?: (n: number) => void) => {
      try {
        // Same gate the attach button uses. Without it a logged-out visitor
        // picks a file, the upload 400s on the nonce check, and the image just
        // never appears — the button looks broken. Prompt to log in instead.
        if (!isLoggedIn) {
          openLoginWarning()
          throw new Error(__('Please log in to upload images.'))
        }

        const { error, file: resized } = await resizeImageIfNeeded(file)
        if (error) throw new Error(error)

        // The resizer only checks that the MIME starts with "image/", which lets
        // through types the server rejects (SVG, BMP, TIFF…). Run the same
        // allowlist the attach button uses so the failure is immediate and
        // specific instead of a late error from the upload. Validating the
        // resized file keeps oversized photos working — they are downscaled first.
        const validation = validateAttachment(resized)
        if (!validation.valid) throw new Error(validation.error)

        const formData = new FormData()
        formData.append('file', resized)
        const response = await uploadRequest<WPAttachmentData>('attachments', formData, {
          onProgress
        })
        insertImage(response.data.url)
      } catch (error_) {
        // The editor's own message is a tooltip on the submit button that clears
        // on the next keystroke, so a failed image could go unnoticed. Report it
        // the way every other failure in the app is reported, then rethrow so the
        // editor still removes its loading placeholder.
        notificationApi?.error({
          message: (error_ as { message?: string })?.message ?? __('Failed to upload image'),
          ...notificationOptions('error')
        })
        throw error_
      }
    },
    [isLoggedIn, notificationApi, openLoginWarning]
  )

  const handleAttachment = useCallback(
    (file: File) => {
      if (!isLoggedIn) {
        openLoginWarning()
        return
      }
      // Dropping the file silently read as the picker being broken; surface the
      // limit the same way every other rejection is surfaced.
      if (filesRef.current.length >= maxAttachments) {
        setFiles(prev => [
          ...prev,
          {
            file,
            fileId: generateFileId(),
            fileName: file.name,
            fileSizeInBytes: file.size,
            fileUrl: '',
            mime: file.type,
            uploadError: __('Attachment limit reached (maximum %d files).').replace(
              '%d',
              String(maxAttachments)
            )
          }
        ])
        return
      }

      const validation = validateAttachment(file)
      if (!validation.valid) {
        setFiles(prev => [
          ...prev,
          {
            file,
            fileId: generateFileId(),
            fileName: file.name,
            fileSizeInBytes: file.size,
            fileUrl: '',
            mime: file.type,
            uploadError: validation.error
          }
        ])
        return
      }

      const fileItem: LocalFileItem = {
        file,
        fileId: generateFileId(),
        fileName: file.name,
        fileSizeInBytes: file.size,
        fileUrl: URL.createObjectURL(file),
        mime: file.type
      }

      setFiles(prev => [...prev, fileItem])
      uploadFile(fileItem)
    },
    [isLoggedIn, maxAttachments, openLoginWarning, uploadFile]
  )

  const removeFile = useCallback((fileId: string) => {
    const file = filesRef.current.find(f => f.fileId === fileId)

    if (file?.wpId && !file.isInitial) {
      queryRequest('attachments/delete', { id: file.wpId })
    }
    if (file?.fileUrl && !file.isInitial) {
      URL.revokeObjectURL(file.fileUrl)
    }

    setFiles(prev => prev.filter(f => f.fileId !== fileId))
  }, [])

  const retryUpload = useCallback(
    (fileId: string) => {
      const file = filesRef.current.find(f => f.fileId === fileId)
      if (file) uploadFile(file)
    },
    [uploadFile]
  )

  const revokeAllUrls = useCallback(() => {
    for (const file of filesRef.current) {
      if (file.fileUrl) URL.revokeObjectURL(file.fileUrl)
    }
  }, [])

  const deleteUnsubmittedFiles = useCallback(() => {
    for (const file of filesRef.current) {
      if (file.wpId && !file.isInitial) {
        queryRequest('attachments/delete', { id: file.wpId })
      }
    }
    revokeAllUrls()
    setFiles([])
  }, [revokeAllUrls])

  const handleSubmit = useCallback(
    (html: string) => {
      if (!onSubmitRef.current) return

      // Format to WordPress comment-compatible HTML and enforce length limit
      const formatted = formatCommentForWordPress(html)
      if (!formatted || getCommentPlainTextLength(formatted) > COMMENT_LIMITS.MAX_TEXT_CHARS) return

      const attachments: WPAttachmentData[] = filesRef.current
        .filter(f => f.wpId)
        .map(f => ({
          filename: f.fileName,
          filesize: f.fileSizeInBytes,
          id: f.wpId!,
          type: f.mime,
          url: f.wpUrl || ''
        }))

      onSubmitRef.current(formatted, attachments.length > 0 ? attachments : undefined)

      revokeAllUrls()
      setFiles([])
      setKey(prev => prev + 1)
    },
    [revokeAllUrls]
  )

  const handleCancel = useCallback(() => {
    deleteUnsubmittedFiles()
    onCancel?.()
  }, [deleteUnsubmittedFiles, onCancel])

  useEffect(() => {
    return () => {
      revokeAllUrls()
    }
  }, [revokeAllUrls])

  return (
    <div className={styles.commentEditorWrapper}>
      {replyTo && (
        <div className="bc-mb-1 bc-text-[12px] bc-text-ink-muted">
          {__('Replying to')} <span className="bc-font-semibold">{replyTo}</span>
        </div>
      )}
      <div key={key}>
        <QuillEditor
          defaultValue={initialContent}
          onAttachment={handleAttachment}
          onImageInsert={handleImagePaste}
          onImagePaste={handleImagePaste}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          showToolbar={true}
          submitButtonText={isUploading ? 'Uploading...' : (submitButtonText ?? 'Comment')}
          submitIconMobile={<SendOutlined />}
        />
      </div>

      {files.length > 0 && (
        <List
          className="bc-mt-2"
          dataSource={files}
          itemLayout="horizontal"
          renderItem={item => (
            <List.Item className="bc-px-0 bc-py-1">
              <List.Item.Meta
                avatar={<FileAvatar file={item} />}
                description={
                  <Space size="small" wrap>
                    <span className="bc-text-xs bc-text-ink-subtle">
                      {formatFileSize(item.fileSizeInBytes)}
                    </span>
                    <UploadStatus file={item} />
                    {item.uploadError && (
                      <Button
                        className="bc-p-0"
                        onClick={() => retryUpload(item.fileId)}
                        size="small"
                        type="link"
                      >
                        Retry
                      </Button>
                    )}
                    <Button
                      className="bc-p-0"
                      danger
                      disabled={item.isUploading}
                      onClick={() => removeFile(item.fileId)}
                      size="small"
                      type="link"
                    >
                      Remove
                    </Button>
                  </Space>
                }
                title={
                  <Typography.Text ellipsis title={item.fileName}>
                    {item.fileName}
                  </Typography.Text>
                }
              />
            </List.Item>
          )}
          size="small"
        />
      )}

      {onCancel && (
        <button
          className="bc-mt-1 bc-cursor-pointer bc-border-0 bc-bg-transparent bc-text-[12px] bc-text-ink-muted hover:bc-text-ink hover:bc-underline"
          onClick={handleCancel}
          type="button"
        >
          {__('Cancel')}
        </button>
      )}
    </div>
  )
}
