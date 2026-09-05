import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { NotificationPreferencesForm } from '@features/notifications'
import { Avatar, Button, Progress } from 'antd'
import { useContext, useRef } from 'react'
import { LuTrash2, LuUpload } from 'react-icons/lu'

import { AVATAR_MAX_BYTES } from '../avatar-validation'
import useAvatarUpload from '../data/use-avatar-upload'
import { type UserPermission } from '../data/use-user-permissions'
import { type UserProfile } from '../data/use-user-profile'
import AccountSecurityForm from './account-security-form'
import CoverImageSection from './cover-image-section'
import PermissionsPanel from './PermissionsPanel'
import ProfileDetailsForm from './profile-details-form'

/**
 * Profile settings for the signed-in member. Only rendered on your own profile.
 *
 * Ordered by how public each section is: picture and cover, then the details
 * everyone can read, then the account settings only the member sees, then what
 * they are allowed to do. The header's camera button remains the quick path for
 * the picture; this is the explicit one, with the constraints spelled out and
 * Remove given its own button rather than being buried in a menu.
 */
export default function ManageSection({
  isLoadingPermissions,
  permissions,
  profile
}: {
  isLoadingPermissions: boolean
  permissions: UserPermission[]
  profile: undefined | UserProfile
}) {
  const { notificationApi } = useContext(NotifyContext)
  const inputRef = useRef<HTMLInputElement>(null)
  const { accept, isRemoving, isUploading, progress, remove, upload } = useAvatarUpload(profile?.id)

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

  const busy = isUploading || isRemoving
  const maxMb = Math.round(AVATAR_MAX_BYTES / (1024 * 1024))

  return (
    <div className="bc-flex bc-flex-col bc-gap-4">
      <section
        aria-label={__('Profile picture')}
        className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
      >
        <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
          {__('Profile picture')}
        </h2>
        <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
          {/* One format string rather than concatenated fragments — translators
              need the whole sentence to reorder it. */}
          {sprintf(
            __('Shown beside everything you post. JPG, PNG, GIF or WebP, up to %s MB.'),
            String(maxMb)
          )}
        </p>

        <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-4">
          <div className="bc-relative">
            <Avatar
              alt={profile?.display_name}
              className="bc-bg-surface-sunken bc-ring-2 bc-ring-surface-sunken"
              size={72}
              src={profile?.avatar}
            >
              {profile?.display_name?.charAt(0)?.toUpperCase()}
            </Avatar>
            {isUploading && (
              <div className="bc-absolute bc-inset-0 bc-flex bc-items-center bc-justify-center bc-rounded-full bc-bg-black/55">
                <Progress
                  format={percent => (
                    <span className="bc-text-[11px] bc-font-semibold bc-text-white">{percent}%</span>
                  )}
                  percent={progress}
                  size={50}
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
              {profile?.has_custom_avatar ? __('Replace') : __('Upload')}
            </Button>
            {/* Only offered when there is a custom picture to remove; removing
                a Gravatar fallback would do nothing. */}
            {profile?.has_custom_avatar && (
              <Button danger disabled={busy} icon={<LuTrash2 size={14} />} onClick={handleRemove}>
                {__('Remove')}
              </Button>
            )}
          </div>
        </div>

        <input
          accept={accept}
          className="bc-hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            // Cleared through the ref so picking the same file twice still
            // fires a change event and a failed upload can be retried.
            if (inputRef.current) inputRef.current.value = ''
            void handleFile(file)
          }}
          ref={inputRef}
          type="file"
        />
      </section>

      <CoverImageSection profile={profile} />

      <ProfileDetailsForm profile={profile} />

      <AccountSecurityForm userId={profile?.id} />

      {/* After the account settings and before permissions: this is a choice
          the member makes, where permissions are a statement of what they have
          been given. */}
      <section
        aria-label={__('Notifications')}
        className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
      >
        <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
          {__('Notifications')}
        </h2>
        <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
          {__('Choose what the forum tells you about, and whether it also emails you.')}
        </p>
        <NotificationPreferencesForm />
      </section>

      <PermissionsPanel isLoading={isLoadingPermissions} isOwnProfile permissions={permissions} />
    </div>
  )
}
