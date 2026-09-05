import {
  DownloadOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileTextOutlined,
  FileWordOutlined,
  FileZipOutlined
} from '@ant-design/icons'
import { Tooltip } from 'antd'

export interface AttachmentSummary {
  filename: string
  filesize: number
  id: number | string
  type?: string
  url: string
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * What kind of file this is, at a glance.
 *
 * The icon slot used to hold the action — a download arrow, or an eye on the
 * ones that open — which is the one thing the reader can already work out from
 * where they clicked. What they cannot work out is what they are about to open,
 * because a long name is truncated exactly where the extension is. The colour is
 * the conventional one per format, so the row is scannable without reading.
 */
const ICONS: [test: RegExp, icon: React.ReactNode][] = [
  [/^image\//, <FileImageOutlined className="bc-text-violet-500" key="image" />],
  [/pdf/, <FilePdfOutlined className="bc-text-red-500" key="pdf" />],
  [/zip|compressed|tar|rar|7z/, <FileZipOutlined className="bc-text-amber-500" key="zip" />],
  [/word|document$|opendocument\.text/, <FileWordOutlined className="bc-text-blue-500" key="word" />],
  [/sheet|excel|csv/, <FileExcelOutlined className="bc-text-green-600" key="excel" />],
  [/presentation|powerpoint/, <FilePptOutlined className="bc-text-orange-500" key="ppt" />],
  [/^text\//, <FileTextOutlined className="bc-text-sky-600" key="text" />]
]

export function fileIconOf(attachment: AttachmentSummary): React.ReactNode {
  const type = attachment.type ?? ''
  const extension = attachment.filename.split('.').pop() ?? ''
  const subject = `${type} ${extension}`.toLowerCase()

  return (
    ICONS.find(([test]) => test.test(subject))?.[1] ?? <FileOutlined className="bc-text-ink-subtle" />
  )
}

/**
 * Name and size of one file.
 *
 * The extension is split off and pinned so it survives truncation: capped at a
 * fixed width, "2.4-Inch-TFT-Terminal-Quick-Start-Guide-Rev-B.pdf" came out as
 * "2.4-Inch-TFT-Terminal-Qu…", which names neither the file nor its format. The
 * head of the name is the part that repeats across a set of exports; the tail is
 * what tells them apart, and it is the first thing an ellipsis eats.
 *
 * Truncated in CSS rather than by character count, because a count cannot know
 * how wide the row is: the same cut that fits a desktop card leaves a phone
 * chip half empty.
 */
export function AttachmentLabel({ attachment }: { attachment: AttachmentSummary }) {
  const sizeLabel = attachment.filesize > 0 ? formatFileSize(attachment.filesize) : undefined
  const dot = attachment.filename.lastIndexOf('.')
  // Only a real extension, not the dot in "v1.2 release notes".
  const hasExtension = dot > 0 && attachment.filename.length - dot <= 6
  const stem = hasExtension ? attachment.filename.slice(0, dot) : attachment.filename
  const extension = hasExtension ? attachment.filename.slice(dot) : ''

  return (
    <span className="bc-flex bc-min-w-0 bc-items-center">
      <span className="bc-truncate bc-font-medium">{stem}</span>
      {extension && <span className="bc-shrink-0 bc-font-medium">{extension}</span>}
      {/* No brackets: the size is a second fact about the file, not an aside
          about its name, and parentheses at 12px read as noise.

          Gone below sm, where two chips share a phone's width: the size costs
          ~40px of a 165px chip, which at 320px was the difference between
          "dashboard-scr….png" and "d.png". Between naming the file and sizing
          it, the name is the one the reader came for; the size returns as soon
          as the chip is wide enough to hold both. */}
      {sizeLabel && (
        <span className="bc-ml-1.5 bc-hidden bc-shrink-0 bc-text-ink-subtle sm:bc-inline">
          {sizeLabel}
        </span>
      )}
    </span>
  )
}

/**
 * The pill every attachment sits in.
 *
 * The same shape the tag links use (see tag-chips): a soft filled pill with no
 * border. An outlined antd button was a heavier object than the file it stood
 * for — a bordered 32px box per attachment, so five of them read as a row of
 * controls rather than a footnote to the topic.
 */
export const CHIP_SHELL =
  'bc-flex bc-w-full bc-items-center bc-gap-1.5 bc-rounded-full bc-py-1 bc-pl-2.5 bc-pr-1 bc-text-[12px] bc-leading-none bc-text-ink bc-no-underline bc-transition-colors'

/**
 * The pill's fill, which depends on what it is sitting on.
 *
 * A comment bubble is already `surface-sunken` (see CommentThread.module.css),
 * so the topic page's grey pill was grey on the same grey inside one — the
 * shape vanished and the chips read as loose text. On a bubble the pill is the
 * raised surface instead, which is the same one-step-apart relationship the
 * topic card gets, in the other direction.
 */
export const chipFill = (variant: 'comment' | 'post') =>
  variant === 'comment'
    ? 'bc-bg-surface hover:bc-bg-surface-hover'
    : 'bc-bg-surface-sunken hover:bc-bg-surface-raised'

/**
 * The name and its icon, as the part of the pill that opens or saves the file.
 * It takes the width the pill has, so the arrow keeps to the right edge and
 * every chip's arrow lines up down the column.
 */
export const CHIP_BODY =
  'bc-flex bc-min-w-0 bc-flex-1 bc-items-center bc-gap-1.5 bc-text-inherit bc-no-underline'

/** Trailing icon action inside the pill — 22px, the smallest comfortable target. */
export const CHIP_ACTION =
  'bc-flex bc-h-[22px] bc-w-[22px] bc-shrink-0 bc-items-center bc-justify-center bc-rounded-full bc-text-ink-subtle bc-no-underline bc-transition-colors hover:bc-bg-surface-raised hover:bc-text-ink'

/**
 * One file, as a chip that downloads it.
 *
 * Used where a file cannot be shown in place — a comment's attachments, and the
 * formats a browser will not render. Where it can, see AttachmentList, which
 * opens it and keeps this as the second action.
 *
 * The whole pill is the download here, so the arrow at the end is a label for
 * what clicking does rather than a target of its own.
 */
export default function AttachmentDownloadButton({
  attachment,
  variant = 'post'
}: {
  attachment: AttachmentSummary
  variant?: 'comment' | 'post'
}) {
  return (
    <Tooltip title={attachment.filename}>
      <a
        className={`${CHIP_SHELL} ${chipFill(variant)} hover:bc-text-ink`}
        download={attachment.filename}
        href={attachment.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className={CHIP_BODY}>
          {fileIconOf(attachment)}
          <AttachmentLabel attachment={attachment} />
        </span>
        <DownloadOutlined className="bc-mr-1 bc-shrink-0 bc-text-ink-subtle" />
      </a>
    </Tooltip>
  )
}
