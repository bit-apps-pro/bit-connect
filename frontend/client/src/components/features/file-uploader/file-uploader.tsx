import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { Button, Tooltip, Upload, type UploadProps } from 'antd'
import { type ReactNode, useContext, useEffect, useRef } from 'react'
import { LuPaperclip } from 'react-icons/lu'

import { acceptMimeTypes, acceptsVideo, fileKindOf, noRoomFor, validateAttachment } from './attachment-validation'
import { DEFAULT_MAX_ATTACHMENTS, type FileItem } from './state/use-file-store'
import useFileStore from './state/use-file-store'

interface FileUploaderProps {
  children?: ReactNode
  iconOnly?: boolean
  /** Attached files other than videos. */
  maxAttachments?: number
  maxVideos?: number
  tooltip?: string
}

const generateFileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const toChosen = (items: FileItem[]) => items.map(item => ({ mime: item.mime, name: item.file_name }))

export default function FileUploader({
  children,
  iconOnly,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
  maxVideos = DEFAULT_MAX_ATTACHMENTS,
  tooltip
}: FileUploaderProps) {
  const { notificationApi } = useContext(NotifyContext)
  const { addFiles, files: storedFiles, setMaxAttachments, uploadFile } = useFileStore()
  const processedFilesRef = useRef<Set<string>>(new Set())

  // The store's ceiling is the two counts together; which kind a file may be
  // is decided here, file by file.
  useEffect(() => {
    setMaxAttachments(maxAttachments + maxVideos)
  }, [maxAttachments, maxVideos, setMaxAttachments])

  const limits = { attachments: maxAttachments, videos: maxVideos }

  const handleChange: UploadProps['onChange'] = ({ fileList }) => {
    const newFiles: FileItem[] = []
    let refusal: string | undefined

    for (const uploadedFile of fileList) {
      const fileKey = `${uploadedFile.name}-${uploadedFile.size}`

      if (processedFilesRef.current.has(fileKey)) continue

      if (
        storedFiles.some(
          existingFile =>
            existingFile.file_name === uploadedFile.name &&
            existingFile.file_size_in_bytes === (uploadedFile.size || 0)
        )
      ) {
        continue
      }

      // A video and a document are counted apart, so whether there is room
      // depends on which this one is.
      const reason = noRoomFor(
        { name: uploadedFile.name, type: uploadedFile.type },
        toChosen([...storedFiles, ...newFiles]),
        limits
      )
      if (reason) {
        refusal ??= reason
        continue
      }

      processedFilesRef.current.add(fileKey)
      newFiles.push({
        file: uploadedFile.originFileObj,
        file_id: generateFileId(),
        file_name: uploadedFile.name,
        file_size_in_bytes: uploadedFile.size || 0,
        file_url: uploadedFile.originFileObj ? URL.createObjectURL(uploadedFile.originFileObj) : '',
        mime: uploadedFile.type || ''
      })
    }

    if (newFiles.length > 0) {
      addFiles(newFiles)

      for (const file of newFiles) {
        uploadFile(file.file_id)
      }
    }

    if (refusal) notificationApi?.warning({ message: refusal })
  }

  const videoCount = storedFiles.filter(item => fileKindOf(item.file_name, item.mime) === 'video').length
  const fileCount = storedFiles.length - videoCount
  const isAtLimit = fileCount >= maxAttachments && (videoCount >= maxVideos || !acceptsVideo())

  const uploadProps: UploadProps = {
    // Validate each file before it enters the Ant Design upload queue.
    // Returning false stops automatic upload; Upload.LIST_IGNORE removes
    // the file from the list entirely so the user doesn't see a failed entry.
    accept: acceptMimeTypes(),
    beforeUpload: file => {
      const result = validateAttachment(file)
      if (!result.valid) {
        notificationApi?.error({ message: result.error })
        return Upload.LIST_IGNORE
      }
      return false
    },
    disabled: isAtLimit,
    fileList: [],
    multiple: true,
    onChange: handleChange,
    showUploadList: false
  }

  const defaultTrigger = iconOnly ? (
    <Button disabled={isAtLimit} icon={<LuPaperclip />} type="text" />
  ) : (
    <Button disabled={isAtLimit} icon={<LuPaperclip />}>
      {__('Add Files')}
      {fileCount > 0 && Number.isFinite(maxAttachments) && ` (${fileCount}/${maxAttachments})`}
    </Button>
  )

  const trigger = children ?? defaultTrigger
  const tooltipTitle = isAtLimit
    ? __('No more files can be added.')
    : (tooltip ?? (iconOnly ? __('Add Files') : undefined))

  return <Upload {...uploadProps}>{tooltipTitle ? <Tooltip title={tooltipTitle}>{trigger}</Tooltip> : trigger}</Upload>
}
