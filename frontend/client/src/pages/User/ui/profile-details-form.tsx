import { __ } from '@common/helpers/i18nWrap'
import { Button, Form, Input } from 'antd'
import { useEffect, useRef } from 'react'
import { LuAtSign, LuGithub, LuGlobe, LuLinkedin, LuSave, LuTwitter } from 'react-icons/lu'

import useUpdateProfile, { type UpdateProfilePayload } from '../data/use-update-profile'
import { SOCIAL_LINK_KEYS, type SocialLinkKey, type UserProfile } from '../data/use-user-profile'

const MAX_BIO = 500

const MAX_DISPLAY_NAME = 60

const LINK_ICONS: Record<SocialLinkKey, React.ReactNode> = {
  github: <LuGithub size={14} />,
  linkedin: <LuLinkedin size={14} />,
  mastodon: <LuAtSign size={14} />,
  twitter: <LuTwitter size={14} />,
  website: <LuGlobe size={14} />
}

type ProfileDetailsFormValues = Partial<Record<SocialLinkKey, string>> & {
  bio: string
  display_name: string
  slug: string
}

/**
 * Name, profile URL, bio and links — everything a member writes about
 * themselves, in one form.
 *
 * One save button rather than per-field saves: the slug and the display name
 * interact (the slug tracks the name until the member picks their own), so a
 * single submit is the only way to apply both in a known order.
 */
export default function ProfileDetailsForm({ profile }: { profile: undefined | UserProfile }) {
  const [form] = Form.useForm<ProfileDetailsFormValues>()
  const { isUpdatingProfile, updateProfile } = useUpdateProfile(form, profile?.id)

  // Built per render rather than at module scope so __() runs after the page's
  // translations exist. Brand names are left alone — only "Website" is a word.
  const linkFields: { key: SocialLinkKey; label: string }[] = [
    { key: 'website', label: __('Website') },
    { key: 'github', label: __('GitHub') },
    { key: 'twitter', label: __('X / Twitter') },
    { key: 'linkedin', label: __('LinkedIn') },
    { key: 'mastodon', label: __('Mastodon') }
  ]

  // Seeded once per member. Without the guard a refetch — the profile query is
  // invalidated on every save — would overwrite whatever they were typing.
  const populatedForId = useRef<null | number>(undefined)

  useEffect(() => {
    if (!profile || populatedForId.current === profile.id) return
    populatedForId.current = profile.id

    const links: Partial<Record<SocialLinkKey, string>> = {}
    SOCIAL_LINK_KEYS.forEach(key => {
      links[key] = profile.social_links[key] ?? ''
    })

    form.setFieldsValue({
      bio: profile.bio,
      display_name: profile.display_name,
      slug: profile.slug,
      ...links
    })
  }, [form, profile])

  const handleSubmit = async (values: ProfileDetailsFormValues) => {
    const links: Partial<Record<SocialLinkKey, string>> = {}
    SOCIAL_LINK_KEYS.forEach(key => {
      links[key] = values[key] ?? ''
    })

    const payload: UpdateProfilePayload = {
      bio: values.bio ?? '',
      display_name: values.display_name,
      links,
      slug: values.slug
    }

    try {
      const response = await updateProfile(payload)
      // The server normalises the slug — "Aiden Carter" is stored as
      // aiden-carter — so show what was saved rather than what was typed.
      const saved = response.data?.user
      if (saved) form.setFieldsValue({ slug: saved.slug })
    } catch {
      // Already reported by the hook, as field errors or a toast.
    }
  }

  return (
    <section
      aria-label={__('Profile details')}
      className="bc-rounded-lg bc-border bc-border-solid bc-border-line bc-bg-surface bc-p-4 sm:bc-p-5"
    >
      <h2 className="bc-mb-1 bc-mt-0 bc-text-[15px] bc-font-semibold bc-text-ink">
        {__('Profile details')}
      </h2>
      <p className="bc-mb-4 bc-mt-0 bc-text-[12px] bc-text-ink-subtle">
        {__('How you appear across the community.')}
      </p>

      <Form<ProfileDetailsFormValues>
        className="[&_.ant-form-item-label>label]:bc-font-semibold"
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark={false}
      >
        <Form.Item
          label={__('Display name')}
          name="display_name"
          rules={[
            { message: __('Please enter a display name'), required: true },
            { max: MAX_DISPLAY_NAME, message: __('Display name must be 60 characters or fewer') }
          ]}
        >
          <Input maxLength={MAX_DISPLAY_NAME} placeholder={__('Your name')} />
        </Form.Item>

        <Form.Item
          extra={__('Links you have already shared keep working — they redirect here.')}
          label={__('Profile URL')}
          name="slug"
          rules={[{ message: __('Please enter a profile URL'), required: true }]}
        >
          <Input addonBefore="/user/" placeholder="your-name" />
        </Form.Item>

        <Form.Item
          label={__('Bio')}
          name="bio"
          rules={[{ max: MAX_BIO, message: __('Your bio is too long') }]}
        >
          <Input.TextArea
            autoSize={{ maxRows: 6, minRows: 3 }}
            maxLength={MAX_BIO}
            placeholder={__('A sentence or two about yourself')}
            showCount
          />
        </Form.Item>

        <h3 className="bc-mb-3 bc-mt-5 bc-text-[11px] bc-font-semibold bc-uppercase bc-tracking-[0.06em] bc-text-ink-subtle">
          {__('Links')}
        </h3>

        <div className="bc-grid bc-gap-x-6 sm:bc-grid-cols-2">
          {linkFields.map(({ key, label }) => (
            <Form.Item
              key={key}
              label={label}
              name={key}
              rules={[{ message: __('Please enter a valid URL'), type: 'url' }]}
            >
              <Input placeholder="https://" prefix={LINK_ICONS[key]} />
            </Form.Item>
          ))}
        </div>

        <Form.Item className="bc-mb-0">
          <Button
            htmlType="submit"
            icon={<LuSave size={14} />}
            loading={isUpdatingProfile}
            type="primary"
          >
            {__('Save changes')}
          </Button>
        </Form.Item>
      </Form>
    </section>
  )
}
