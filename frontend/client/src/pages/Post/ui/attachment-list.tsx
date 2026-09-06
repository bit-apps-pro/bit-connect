import { DownloadOutlined } from '@ant-design/icons'
import { __ } from '@common/helpers/i18nWrap'
import { type TopicAttachmentInfo } from '@features/topic-modal/shared/type'
import { Button, Image, Tooltip } from 'antd'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import AttachmentDownloadButton, {
  AttachmentLabel,
  CHIP_ACTION,
  CHIP_BODY,
  CHIP_SHELL,
  chipFill,
  fileIconOf
} from './attachement-download-btn'

/** Chips shown before the rest collapse behind a "+N more" toggle. */
const VISIBLE_LIMIT = 3

/** No preview open. */
const CLOSED = -1

const isImage = (attachment: TopicAttachmentInfo) => attachment.type?.startsWith('image/') ?? false

/**
 * Types a browser renders by itself, so opening one means reading it rather
 * than saving it. Everything else — a zip, a .docx — can only be downloaded,
 * and offering to "view" it would just be a download with another name.
 */
const isBrowserViewable = (attachment: TopicAttachmentInfo) =>
  attachment.type === 'application/pdf' || (attachment.type?.startsWith('text/') ?? false)

/**
 * The attachments on a topic or a comment.
 *
 * One chip per file, whatever the file is. Every file used to be a download
 * chip, which made looking at a screenshot somebody attached to a bug report
 * cost a round trip through the downloads folder — for the one kind of file the
 * browser can already show. Now the name opens what can be opened: a picture in
 * the viewer, a PDF in a tab. The arrow at the end always saves.
 *
 * Pictures wear a thumbnail of themselves where the other files wear a format
 * icon. A grid of thumbnails said more about the pictures but nothing about
 * anything else, and it made the two halves of one list read as two lists — the
 * pictures a gallery, the rest a footnote — when the reader's question is the
 * same for both: what came with this, and what is it.
 *
 * A comment's files are the same files, differing only in what they sit on;
 * `variant` carries that, and the caller sets the spacing.
 */
export default function AttachmentList({
  attachments,
  className = 'bc-mb-2 lg:bc-mb-4',
  variant = 'post'
}: {
  attachments: TopicAttachmentInfo[]
  className?: string
  variant?: 'comment' | 'post'
}) {
  const [expanded, setExpanded] = useState(false)
  const [previewAt, setPreviewAt] = useState(CLOSED)

  const images = attachments.filter(element => isImage(element))
  const hiddenCount = attachments.length - VISIBLE_LIMIT
  const visible = expanded ? attachments : attachments.slice(0, VISIBLE_LIMIT)
  const shell = `${CHIP_SHELL} ${chipFill(variant)}`

  return (
    <div className={className}>
      {/* Equal cells rather than pills each as wide as its own filename: a
          column of chips that all end in a different place reads as a ragged
          edge, and the download arrows — the one control in the row — landed at
          four different distances from it.

          Two per row on a phone, which halves the height a set of files costs
          on the screen with the least of it. From sm the cells are as many
          200px-or-wider columns as fit, so the name gets the room a wider card
          has to give it rather than being cut to keep a column count.

          One per row below 360px, though: at 320 a half-width chip left 28px
          for the filename, which rendered "dashboard-screenshot.png" as
          "d.png". Two columns are worth having only while each can still name
          what is in it. */}
      <div className="bc-grid bc-grid-cols-1 bc-gap-2 min-[360px]:bc-grid-cols-2 sm:bc-grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
        {visible.map(attachment => {
          const imageAt = images.findIndex(element => element.id === attachment.id)

          // A picture: the name opens the viewer in place. Not a link, because
          // there is nowhere to go — following it to the file itself would leave
          // the topic to land on a bare image on a white page, with the reader's
          // way back being the browser's own.
          if (imageAt !== -1) {
            return (
              <div className={shell} key={attachment.id}>
                <Tooltip title={`${__('Preview')} ${attachment.filename}`}>
                  <button
                    className={`${CHIP_BODY} bc-cursor-pointer bc-border-0 bc-bg-transparent bc-p-0 bc-[font:inherit] hover:bc-text-primary`}
                    onClick={() => setPreviewAt(imageAt)}
                    type="button"
                  >
                    {/* The file's own icon is the file. At 20px it says which
                      screenshot this is in a way "image/png" never could. */}
                    <img
                      alt=""
                      className="bc-h-5 bc-w-5 bc-shrink-0 bc-rounded bc-object-cover"
                      src={attachment.url}
                    />
                    <AttachmentLabel attachment={attachment} />
                  </button>
                </Tooltip>
                <Tooltip title={__('Download')}>
                  <a
                    aria-label={`${__('Download')} ${attachment.filename}`}
                    className={CHIP_ACTION}
                    download={attachment.filename}
                    href={attachment.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <DownloadOutlined />
                  </a>
                </Tooltip>
              </div>
            )
          }

          // Two actions in one pill rather than two buttons joined by a seam: it
          // is one file, and the split between opening it and keeping it is not
          // worth a second border.
          if (isBrowserViewable(attachment)) {
            return (
              <div className={shell} key={attachment.id}>
                <Tooltip title={`${__('Open')} ${attachment.filename}`}>
                  <a
                    className={`${CHIP_BODY} hover:bc-text-primary`}
                    href={attachment.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {fileIconOf(attachment)}
                    <AttachmentLabel attachment={attachment} />
                  </a>
                </Tooltip>
                <Tooltip title={__('Download')}>
                  <a
                    aria-label={`${__('Download')} ${attachment.filename}`}
                    className={CHIP_ACTION}
                    download={attachment.filename}
                    href={attachment.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <DownloadOutlined />
                  </a>
                </Tooltip>
              </div>
            )
          }

          return (
            <AttachmentDownloadButton attachment={attachment} key={attachment.id} variant={variant} />
          )
        })}
      </div>

      {/* Outside the grid: a text toggle is not a file and should not be given
          a file's cell, where it would sit alone in 200px of empty row. */}
      {hiddenCount > 0 && (
        <Button
          className="bc--ml-2 bc-mt-1"
          onClick={() => setExpanded(previous => !previous)}
          size="small"
          type="text"
        >
          {expanded ? __('Show less') : `+${hiddenCount} ${__('more')}`}
        </Button>
      )}

      {/* The viewer with no thumbnails of its own: `items` gives the group its
          pictures, and the chips above say which one to open. Every picture is
          in here, including the ones still folded behind "+N more" — once the
          viewer is open, paging through the set is the point of it. */}
      {images.length > 0 && (
        <Image.PreviewGroup
          items={images.map(image => image.url)}
          preview={{
            current: previewAt === CLOSED ? 0 : previewAt,
            onChange: setPreviewAt,
            onVisibleChange: isOpen => {
              if (!isOpen) setPreviewAt(CLOSED)
            },
            // Keeping the file is a decision the reader should not have to
            // leave the viewer to make, so the viewer carries the download.
            //
            // Beside the close button rather than appended to the toolbar: that
            // toolbar is 360px of a 390px phone before anything is added to it,
            // so a seventh control in that row began 33px past the edge of the
            // screen. The top corner has room at every width, and is where a
            // photo viewer's actions are looked for anyway. It matches the close
            // button's own 42px box and 32px inset, so the two read as one row.
            //
            // Portalled to the body because `fixed` alone does not get there:
            // the viewer animates its wrapper with a transform, which makes that
            // wrapper the containing block for anything fixed inside it, and the
            // button resolved its top-right against a bar sitting at the bottom
            // of the screen — landing on top of the zoom controls.
            toolbarRender: (originalNode, { current }) => (
              <>
                {originalNode}
                {typeof document !== 'undefined' &&
                  createPortal(
                    <a
                      aria-label={__('Download')}
                      className="bc-fixed bc-right-[86px] bc-top-8 bc-z-[1081] bc-flex bc-h-[42px] bc-w-[42px] bc-items-center bc-justify-center bc-rounded-full bc-bg-black/10 bc-text-[18px] bc-text-white bc-no-underline bc-transition-colors hover:bc-bg-black/20 hover:bc-text-white"
                      download={images[current]?.filename}
                      href={images[current]?.url}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={__('Download')}
                    >
                      <DownloadOutlined />
                    </a>,
                    document.body
                  )}
              </>
            ),
            visible: previewAt !== CLOSED
          }}
        />
      )}
    </div>
  )
}
