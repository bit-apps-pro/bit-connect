import { __ } from '@common/helpers/i18nWrap'

import LimitRow, { ALLOWED_FILE_TYPES, formatBytes, getWpMediaSettings, LimitRows } from './limit-row'
import SectionCard from './section-card'

/**
 * What may be uploaded, stated.
 *
 * This plugin limits nothing a member posts — no cap on length, images or
 * files — so the only limits worth stating are the ones it does not set: what
 * the server accepts, and the image size WordPress scales down to. Both are
 * read from the page (Head.php), never restated.
 */
export default function PostingLimitsSection() {
  const media = getWpMediaSettings()

  return (
    <SectionCard
      subtitle={__(
        'Set by your server and WordPress. Pasted images larger than these are resized before upload.'
      )}
      title={__('Uploads')}
    >
      <LimitRows>
        <LimitRow
          hint={__('The largest file your server accepts.')}
          label={__('Max file size')}
          value={media ? formatBytes(media.maxUploadBytes) : '-'}
        />
        <LimitRow
          hint={__('Larger images are scaled down by WordPress.')}
          label={__('Max image dimensions')}
          value={media ? `${media.bigImageThresholdPx} px` : '-'}
        />
        <LimitRow label={__('Allowed file types')} value={ALLOWED_FILE_TYPES} />
      </LimitRows>
    </SectionCard>
  )
}
