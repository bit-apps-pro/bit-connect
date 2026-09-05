import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { Button, Progress } from 'antd'
import { useContext, useRef } from 'react'
import { LuTrash2, LuUpload } from 'react-icons/lu'

import { COVER_MAX_BYTES } from '../cover-validation'
import useCoverUpload from '../data/use-cover-upload'
import { type UserProfile } from '../data/use-user-profile'

/**
 * The banner strip behind the avatar on the profile card.
 *
 * Shows the real strip rather than a generic dropzone: it is 56px tall and
 * cropped to fill, so a member picking a tall photo needs to see what actually
 * survives that crop before they commit to it.
 */
export default function CoverImageSection({ profile }: { profile: undefined | UserProfile }) {
  const { notificationApi } = useContext(NotifyContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const { accept, isRemoving, isUploading, progress, remove, upload } = useCoverUpload(profile?.id)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const error = await upload(file)
    if (error) {
      notificationApi?.error({ description: error, message: __('Could not update your cover') })
      return
    }
    notificationApi?.success({ message: __('Cover image updated') })
  }

  const handleRemove = async () => {
    const error = await remove()
    if (error) {
      notificationApi?.error({ description: error, message: __('Could not remove your cover') })
      return
    }
    notificationApi?.success({ message: __('Cover image removed') })
  }

  const busy = isUploading || isRemoving
  const maxMb = Math.round(COVER_MAX_BYTES / (1024 * 1024))

  return (
    <section
      aria-label={__('Cover image')}
      className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
    >
      <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
        {__('Cover image')}
      </h2>
      <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
        {sprintf(
          __('The strip behind your picture. Wide images work best — up to %s MB.'),
          String(maxMb)
        )}
      </p>

      <div className="bc-relative bc-mb-4 bc-h-14 bc-overflow-hidden bc-rounded">
        {profile?.cover ? (
          <img
            alt=""
            className="bc-h-full bc-w-full bc-object-cover"
            // Decorative: the section heading already names it, so announcing
            // the file to a screen reader adds nothing.
            src={profile.cover}
          />
        ) : (
          <div className="bc-h-full bc-w-full bc-bg-gradient-to-r bc-from-primary bc-to-[#7B9BF5]" />
        )}

        {isUploading && (
          <div className="bc-absolute bc-inset-0 bc-flex bc-items-center bc-justify-center bc-bg-black/55">
            <Progress
              format={percent => (
                <span className="bc-text-[11px] bc-font-semibold bc-text-white">{percent}%</span>
              )}
              percent={progress}
              size={40}
              strokeColor="#fff"
              trailColor="rgba(255,255,255,0.3)"
              type="circle"
            />
          </div>
        )}
      </div>

      <div className="bc-flex bc-flex-wrap bc-gap-2">
        <Button
          disabled={busy}
          icon={<LuUpload size={14} />}
          onClick={() => inputRef.current?.click()}
          type="primary"
        >
          {profile?.has_custom_cover ? __('Replace') : __('Upload')}
        </Button>
        {/* Only offered when there is a cover to remove; the gradient is a
            fallback, not something a member can delete. */}
        {profile?.has_custom_cover && (
          <Button danger disabled={busy} icon={<LuTrash2 size={14} />} onClick={handleRemove}>
            {__('Remove')}
          </Button>
        )}
      </div>

      <input
        accept={accept}
        className="bc-hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          // Cleared through the ref so picking the same file twice still fires
          // a change event and a failed upload can be retried.
          if (inputRef.current) inputRef.current.value = ''
          void handleFile(file)
        }}
        ref={inputRef}
        type="file"
      />
    </section>
  )
}
