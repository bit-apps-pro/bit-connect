import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { Avatar, Dropdown, type MenuProps, Progress } from 'antd'
import { useContext, useRef } from 'react'
import { LuCamera, LuTrash2, LuUpload } from 'react-icons/lu'

import useAvatarUpload from '../data/use-avatar-upload'

/**
 * The profile picture, with an edit affordance when it is your own.
 *
 * On someone else's profile this renders a plain avatar — the camera button,
 * the menu and the file input are all absent rather than merely disabled, so
 * there is nothing to click and nothing to reason about.
 */
export default function AvatarEditor({
  avatar,
  canEdit,
  hasCustomAvatar,
  name,
  userId
}: {
  avatar: string | undefined
  canEdit: boolean
  hasCustomAvatar: boolean
  name: string | undefined
  userId: number | string | undefined
}) {
  const { notificationApi } = useContext(NotifyContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const { accept, isRemoving, isUploading, progress, remove, upload } = useAvatarUpload(userId)

  const picture = (
    <Avatar alt={name} className="bc-bg-surface bc-ring-4 bc-ring-surface" size={80} src={avatar}>
      {name?.charAt(0)?.toUpperCase()}
    </Avatar>
  )

  if (!canEdit) return picture

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    const error = await upload(file)
    if (error) {
      notificationApi?.error({ description: error, message: __('Could not update your picture') })
      return
    }
    notificationApi?.success({ message: __('Profile picture updated') })
  }

  const handleRemove = async () => {
    const error = await remove()
    if (error) {
      notificationApi?.error({ description: error, message: __('Could not remove your picture') })
      return
    }
    notificationApi?.success({ message: __('Profile picture removed') })
  }

  const items: MenuProps['items'] = [
    {
      icon: <LuUpload size={14} />,
      key: 'upload',
      label: hasCustomAvatar ? __('Replace picture') : __('Upload a picture'),
      onClick: () => inputRef.current?.click()
    },
    // Only offered when there is a custom picture to remove — otherwise the
    // action would silently do nothing to the Gravatar fallback.
    ...(hasCustomAvatar
      ? [
          {
            danger: true,
            icon: <LuTrash2 size={14} />,
            key: 'remove',
            label: __('Remove picture'),
            onClick: handleRemove
          }
        ]
      : [])
  ]

  const busy = isUploading || isRemoving

  return (
    <div className="bc-relative bc-inline-block">
      {picture}

      {/* Dimmed overlay with the live percentage while bytes are in flight. */}
      {isUploading && (
        <div className="bc-absolute bc-inset-1 bc-flex bc-items-center bc-justify-center bc-rounded-full bc-bg-black/55">
          <Progress
            format={percent => (
              <span className="bc-text-[11px] bc-font-semibold bc-text-white">{percent}%</span>
            )}
            percent={progress}
            size={54}
            strokeColor="#fff"
            trailColor="rgba(255,255,255,0.3)"
            type="circle"
          />
        </div>
      )}

      <Dropdown disabled={busy} menu={{ items }} placement="bottomRight" trigger={['click']}>
        <button
          aria-label={__('Change profile picture')}
          className={[
            'bc-absolute bc--bottom-0.5 bc--right-0.5 bc-flex bc-h-8 bc-w-8 bc-items-center bc-justify-center',
            'bc-cursor-pointer bc-rounded-full bc-border-2 bc-border-solid bc-border-surface bc-bg-primary',
            'bc-text-white bc-shadow-sm bc-transition-transform hover:bc-scale-105 active:bc-scale-95',
            busy ? 'bc-opacity-60' : ''
          ].join(' ')}
          type="button"
        >
          <LuCamera size={15} />
        </button>
      </Dropdown>

      <input
        accept={accept}
        className="bc-hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          // Clear the input through the ref rather than the event target:
          // picking the same file twice in a row fires no change event
          // otherwise, so a failed upload could not be retried.
          if (inputRef.current) inputRef.current.value = ''
          void handleFile(file)
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}
