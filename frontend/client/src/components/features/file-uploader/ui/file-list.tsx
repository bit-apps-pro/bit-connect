import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileOutlined,
  FilePdfOutlined,
  LoadingOutlined
} from '@ant-design/icons'
import { __ } from '@common/helpers/i18nWrap'
import { Button, List, Progress, Space, Typography } from 'antd'

import { type FileItem } from '../state/use-file-store'
import useFileStore from '../state/use-file-store'

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const generateAvatar = (file: FileItem) => {
  const { file_url: fileUrl, mime } = file

  if (mime.startsWith('image/')) {
    return (
      <img
        alt={file.file_name}
        src={file.wp_url || fileUrl}
        style={{ height: 50, objectFit: 'cover', width: 50 }}
      />
    )
  }

  if (mime === 'application/pdf') {
    return <FilePdfOutlined style={{ color: 'red', fontSize: 50 }} />
  }

  return <FileOutlined style={{ fontSize: 50 }} />
}

const UploadStatus = ({ file }: { file: FileItem }) => {
  if (file.isUploading) {
    // Real percentage from the request's progress events. Once the bytes are
    // sent the server still has to process them, so 100 reads as "Processing".
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

  if (file.wp_id) {
    return (
      <Space className="bc-text-green-600" size="small">
        <CheckCircleOutlined />
        <span>{__('Uploaded')}</span>
      </Space>
    )
  }

  return
}

export default function FileList({ files }: { files: FileItem[] }) {
  const { removeFile, uploadFile } = useFileStore()

  return (
    <List
      className="bc-mt-2"
      dataSource={files}
      itemLayout="horizontal"
      renderItem={item => (
        <List.Item className="bc-px-0">
          <List.Item.Meta
            avatar={generateAvatar(item)}
            description={
              <Space size="small" wrap>
                <span className="bc-text-xs bc-text-ink-subtle">
                  {formatFileSize(item.file_size_in_bytes)}
                </span>
                <UploadStatus file={item} />
                {item.uploadError && (
                  <Button
                    className="bc-p-0"
                    onClick={() => uploadFile(item.file_id)}
                    size="small"
                    type="link"
                  >
                    {__('Retry')}
                  </Button>
                )}
                <Button
                  className="bc-p-0"
                  danger
                  disabled={item.isUploading}
                  onClick={() => removeFile(item.file_id)}
                  size="small"
                  type="link"
                >
                  {__('Remove')}
                </Button>
              </Space>
            }
            title={
              <Typography.Text ellipsis title={item.file_name}>
                {item.file_name}
              </Typography.Text>
            }
          />
        </List.Item>
      )}
      size="small"
    />
  )
}
