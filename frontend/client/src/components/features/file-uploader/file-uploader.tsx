import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { Button, Tooltip, Upload, type UploadProps } from 'antd'
import { type ReactNode, useContext, useEffect, useRef } from 'react'
import { LuPaperclip } from 'react-icons/lu'

import { acceptMimeTypes, validateAttachment } from './attachment-validation'
import { DEFAULT_MAX_ATTACHMENTS, type FileItem } from './state/use-file-store'
import useFileStore from './state/use-file-store'

interface FileUploaderProps {
  children?: ReactNode
  iconOnly?: boolean
  maxAttachments?: number
  tooltip?: string
}

const generateFileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export default function FileUploader({
  children,
  iconOnly,
  maxAttachments = DEFAULT_MAX_ATTACHMENTS,
  tooltip
}: FileUploaderProps) {
  const { notificationApi } = useContext(NotifyContext)
  const { addFiles, files: storedFiles, setMaxAttachments, uploadFile } = useFileStore()
  const processedFilesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setMaxAttachments(maxAttachments)
  }, [maxAttachments, setMaxAttachments])

  const handleChange: UploadProps['onChange'] = ({ fileList }) => {
    const remaining = maxAttachments - storedFiles.length

    if (remaining <= 0) {
      notificationApi?.warning({ message: __(`Maximum ${maxAttachments} attachments allowed`) })
      return
    }

    const newFiles: FileItem[] = fileList
      .filter(uploadedFile => {
        const fileKey = `${uploadedFile.name}-${uploadedFile.size}`

        if (processedFilesRef.current.has(fileKey)) {
          return false
        }

        if (
          storedFiles.some(
            existingFile =>
              existingFile.file_name === uploadedFile.name &&
              existingFile.file_size_in_bytes === (uploadedFile.size || 0)
          )
        ) {
          return false
        }

        processedFilesRef.current.add(fileKey)
        return true
      })
      .slice(0, remaining)
      .map(uploadedFile => ({
        file: uploadedFile.originFileObj,
        file_id: generateFileId(),
        file_name: uploadedFile.name,
        file_size_in_bytes: uploadedFile.size || 0,
        file_url: uploadedFile.originFileObj ? URL.createObjectURL(uploadedFile.originFileObj) : '',
        mime: uploadedFile.type || ''
      }))

    if (newFiles.length > 0) {
      addFiles(newFiles)

      for (const file of newFiles) {
        uploadFile(file.file_id)
      }
    }

    if (fileList.length > remaining) {
      notificationApi?.warning({
        message: __(`Only ${remaining} more file(s) can be added. Maximum is ${maxAttachments}.`)
      })
    }
  }

  const isAtLimit = storedFiles.length >= maxAttachments

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
      {storedFiles.length > 0 && ` (${storedFiles.length}/${maxAttachments})`}
    </Button>
  )

  const trigger = children ?? defaultTrigger
  const tooltipTitle = isAtLimit
    ? __(`Maximum ${maxAttachments} attachments reached`)
    : (tooltip ?? (iconOnly ? __('Add Files') : undefined))

  return (
    <Upload {...uploadProps} maxCount={maxAttachments}>
      {tooltipTitle ? <Tooltip title={tooltipTitle}>{trigger}</Tooltip> : trigger}
    </Upload>
  )
}
