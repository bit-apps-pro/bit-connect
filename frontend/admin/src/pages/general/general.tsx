import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import useCopyToClipboard from '@common/hooks/useCopyToClipboard'
import { Button, Spin, Tabs, Typography } from 'antd'
import { MotionConfig } from 'framer-motion'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import useAuthSettings from '../settings/data/use-auth-settings'
import useUpdateAuthSettings from '../settings/data/use-update-auth-settings'
import { validateAuthForm } from '../settings/shared/auth-validation'
import { type AuthSettings } from '../settings/shared/types'
import useGeneralSettings from './data/use-general-settings'
import usePortalPage from './data/use-portal-page'
import useUpdateGeneralSettings from './data/use-update-general-settings'
import useUpdatePortalSlug from './data/use-update-portal-slug'
import AccessSection from './internal/access-section'
import AuthSection from './internal/auth-section'
import BrandingSection from './internal/branding-section'
import LocationSection from './internal/location-section'
import PromoSection from './internal/promo-section'
import { type GeneralSettings, type PortalFilters, type Promo } from './shared/types'

const { Text, Title } = Typography

/** Same value, ignoring object identity — enough for form-vs-saved comparison. */
const isSame = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export default function General() {
  const { notificationApi } = useContext(NotifyContext)
  const { generalSettings } = useGeneralSettings()
  const { isUpdatingGeneralSettings, updateGeneralSettings } = useUpdateGeneralSettings()
  const { authSettings } = useAuthSettings()
  const { isUpdatingAuthSettings, updateAuthSettings } = useUpdateAuthSettings()
  const { portalPage, refetchPortalPage } = usePortalPage()
  const { updatePortalSlug } = useUpdatePortalSlug()
  const { copy } = useCopyToClipboard()

  const [form, setForm] = useState<GeneralSettings>(generalSettings)
  const [authForm, setAuthForm] = useState<AuthSettings>(authSettings)
  const [phrasesDraft, setPhrasesDraft] = useState(generalSettings.promo.phrases.join('\n'))
  const [slugInput, setSlugInput] = useState('')

  useEffect(() => {
    setForm(generalSettings)
    setPhrasesDraft(generalSettings.promo.phrases.join('\n'))
  }, [generalSettings])
  useEffect(() => {
    setAuthForm(authSettings)
  }, [authSettings])
  useEffect(() => {
    setSlugInput(portalPage.slug)
  }, [portalPage.slug])

  const patch = useCallback((values: Partial<GeneralSettings>) => {
    setForm(prev => ({ ...prev, ...values }))
  }, [])

  const patchAuth = useCallback((values: Partial<AuthSettings>) => {
    setAuthForm(prev => ({ ...prev, ...values }))
  }, [])

  const patchPortalFilter = useCallback((key: keyof PortalFilters, visible: boolean) => {
    setForm(prev => ({ ...prev, portalFilters: { ...prev.portalFilters, [key]: visible } }))
  }, [])

  const patchPromo = useCallback((values: Partial<Promo>) => {
    setForm(prev => ({ ...prev, promo: { ...prev.promo, ...values } }))
  }, [])

  // Across the whole page, not per tab: Save writes all of it at once, so this
  // is the one question the button has to answer.
  const isDirty = useMemo(
    () =>
      !isSame(form, generalSettings) ||
      !isSame(authForm, authSettings) ||
      slugInput.trim() !== portalPage.slug,
    [form, generalSettings, authForm, authSettings, slugInput, portalPage.slug]
  )

  const handleSave = useCallback(async () => {
    const authError = validateAuthForm(authForm)
    if (authError) {
      notificationApi?.error({ message: authError })
      return
    }
    if (!portalPage.root && !slugInput.trim()) {
      notificationApi?.error({ message: __('Portal slug is required') })
      return
    }
    notificationApi?.open({
      duration: 0,
      icon: <Spin size="small" />,
      key: 'save',
      message: __('Saving…')
    })
    try {
      // In root mode the portal has no slug to change, and the input is disabled.
      const slugChanged =
        !portalPage.root && slugInput.trim() !== '' && slugInput.trim() !== portalPage.slug
      const results = await Promise.all([
        updateGeneralSettings(form),
        updateAuthSettings(authForm),
        ...(slugChanged ? [updatePortalSlug(slugInput.trim())] : [])
      ])
      const slugResult = results[2]
      if (slugChanged) refetchPortalPage()
      notificationApi?.success({ key: 'save', message: __('Settings saved successfully') })

      const pageExists =
        (slugResult as { data?: { pageExists?: boolean }; pageExists?: boolean })?.data?.pageExists ??
        (slugResult as { pageExists?: boolean })?.pageExists
      if (slugChanged && pageExists === false) {
        notificationApi?.warning({
          description: __(
            'There is no page at the new address yet. Create one with the shortcode in it, or rename your community page to match.'
          ),
          message: __('Address saved, but no page is there yet')
        })
      }
    } catch (error: unknown) {
      const msg = (error as { message?: string })?.message ?? __('Failed to save settings')
      notificationApi?.error({ key: 'save', message: msg })
    }
  }, [
    form,
    authForm,
    slugInput,
    portalPage,
    notificationApi,
    updateGeneralSettings,
    updateAuthSettings,
    updatePortalSlug,
    refetchPortalPage
  ])

  const isSaving = isUpdatingGeneralSettings || isUpdatingAuthSettings
  const disabled = isSaving

  const tabs = [
    {
      children: (
        <BrandingSection
          disabled={disabled}
          form={form}
          onCopy={copy}
          onPatch={patch}
          portalUrl={portalPage.url}
        />
      ),
      key: 'branding',
      label: __('Branding')
    },
    {
      children: (
        <LocationSection
          disabled={disabled}
          onCopy={copy}
          onSlugChange={setSlugInput}
          portalPage={portalPage}
          slug={slugInput}
        />
      ),
      key: 'location',
      label: __('Location')
    },
    {
      children: (
        <AccessSection
          disabled={disabled}
          form={form}
          onPatch={patch}
          onPatchFilter={patchPortalFilter}
        />
      ),
      key: 'access',
      label: __('Access')
    },
    {
      children: <AuthSection disabled={disabled} form={authForm} onCopy={copy} onPatch={patchAuth} />,
      key: 'auth',
      label: __('Sign in')
    },
    {
      children: (
        <PromoSection
          disabled={disabled}
          onPatch={patchPromo}
          onPhrasesDraftChange={setPhrasesDraft}
          phrasesDraft={phrasesDraft}
          promo={form.promo}
        />
      ),
      key: 'promo',
      label: __('Sidebar card')
    }
  ]

  return (
    // `reducedMotion="user"` rather than a per-component check: everything on
    // this page keeps its opacity fades but stops moving for anyone whose
    // system asks for that.
    <MotionConfig reducedMotion="user">
      <div className="bc-px-5 bc-pb-6">
        {/* Save sits with the heading rather than after the panels: an edit made
            on one tab has to stay savable from any other. */}
        <div className="bc-flex bc-flex-wrap bc-items-start bc-justify-between bc-gap-3 bc-py-6">
          <div className="bc-min-w-0">
            <Title className="bc-mb-1" level={2}>
              {__('General')}
            </Title>
            <Text type="secondary">
              {__('What the portal is called, where it lives, who can see it, and how people sign in.')}
            </Text>
          </div>

          <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-3">
            {isDirty && <Text type="secondary">{__('Unsaved changes')}</Text>}
            <Button
              disabled={disabled || !isDirty}
              loading={isSaving}
              onClick={handleSave}
              size="large"
              type="primary"
            >
              {__('Save')}
            </Button>
          </div>
        </div>

        <Tabs items={tabs} />
      </div>
    </MotionConfig>
  )
}
