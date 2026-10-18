import { __ } from '@common/helpers/i18nWrap'
import useAutoSave from '@common/hooks/use-auto-save'
import useCopyToClipboard from '@common/hooks/useCopyToClipboard'
import { useCallback, useState } from 'react'

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
import BrandingExtras from './internal/branding-extras'
import BrandingSection from './internal/branding-section'
import LocationSection from './internal/location-section'
import SidebarSection from './internal/sidebar-section'
import TopicListFiltersSection from './internal/topic-list-filters-section'
import { type GeneralSettings, type PortalFilters } from './shared/types'

interface GeneralProps {
  /** Which tab of the Settings screen this is drawing. */
  section: 'portal' | 'sign-in'
}

/**
 * The Portal and Sign in tabs of the Settings screen: how the community looks,
 * where it lives, who may read it, and how people get in.
 *
 * Each store saves as it changes and reports under its own key, so the one
 * status line beside the Settings title speaks for these tabs too.
 */
export default function General({ section }: GeneralProps) {
  const { generalSettings, isGeneralSettingsPending } = useGeneralSettings()
  const { updateGeneralSettings } = useUpdateGeneralSettings()
  const { authSettings, isAuthSettingsPending } = useAuthSettings()
  const { updateAuthSettings } = useUpdateAuthSettings()
  const { isPortalPagePending, portalPage, refetchPortalPage } = usePortalPage()
  const { updatePortalSlug } = useUpdatePortalSlug()
  const { copy } = useCopyToClipboard()

  const [form, setForm] = useState<GeneralSettings>(generalSettings)
  const [authForm, setAuthForm] = useState<AuthSettings>(authSettings)
  const [slugInput, setSlugInput] = useState('')

  // No toast when the new slug has no page behind it: the address card says
  // so itself, in place, next to the button that creates the page.
  const saveSlug = useCallback(
    async (slug: string) => {
      await updatePortalSlug(slug.trim())
      refetchPortalPage()
    },
    [refetchPortalPage, updatePortalSlug]
  )

  // Three stores, each saved as it changes. Text waits for a pause in typing;
  // the slug waits for its field to be left, since every topic URL follows it
  // and a half-typed one would briefly move them all.
  useAutoSave({
    draft: form,
    key: 'general',
    save: updateGeneralSettings,
    saved: isGeneralSettingsPending ? undefined : generalSettings,
    setDraft: setForm
  })
  useAutoSave({
    draft: authForm,
    key: 'auth',
    save: updateAuthSettings,
    saved: isAuthSettingsPending ? undefined : authSettings,
    setDraft: setAuthForm,
    validate: validateAuthForm
  })
  // In root mode the portal has no slug to change, and the input is disabled.
  const slugSave = useAutoSave({
    delay: 'manual',
    draft: slugInput,
    enabled: !portalPage.root,
    key: 'portal-slug',
    save: saveSlug,
    saved: isPortalPagePending ? undefined : portalPage.slug,
    serialize: slug => slug.trim(),
    setDraft: setSlugInput,
    validate: slug => (slug.trim() === '' ? __('Portal slug is required') : undefined)
  })

  const patch = useCallback((values: Partial<GeneralSettings>) => {
    setForm(prev => ({ ...prev, ...values }))
  }, [])

  const patchAuth = useCallback((values: Partial<AuthSettings>) => {
    setAuthForm(prev => ({ ...prev, ...values }))
  }, [])

  const patchPortalFilter = useCallback((key: keyof PortalFilters, visible: boolean) => {
    setForm(prev => ({ ...prev, portalFilters: { ...prev.portalFilters, [key]: visible } }))
  }, [])

  // Only while loading: a save in flight never locks the form, and an edit
  // made during one is saved after it.
  const disabled = isGeneralSettingsPending || isAuthSettingsPending

  if (section === 'sign-in') {
    return <AuthSection disabled={disabled} form={authForm} onCopy={copy} onPatch={patchAuth} />
  }

  // How it looks first, then where it lives and who may read it.
  return (
    <>
      <BrandingSection
        disabled={disabled}
        form={form}
        onCopy={copy}
        onPatch={patch}
        portalUrl={portalPage.url}
      />
      {BrandingExtras && <BrandingExtras />}
      <TopicListFiltersSection disabled={disabled} form={form} onPatchFilter={patchPortalFilter} />
      <SidebarSection disabled={disabled} form={form} onPatch={patch} />
      <LocationSection
        disabled={disabled}
        onCopy={copy}
        onSlugChange={setSlugInput}
        onSlugCommit={() => slugSave.flush()}
        portalPage={portalPage}
        slug={slugInput}
      />
      <AccessSection disabled={disabled} form={form} onPatch={patch} />
    </>
  )
}
