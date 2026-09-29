import NotifyContext from '@common/context/NotifyContext'
import { __ } from '@common/helpers/i18nWrap'
import { PageSaveContext, type SaveParticipant } from '@common/hooks/page-save'
import useCopyToClipboard from '@common/hooks/useCopyToClipboard'
import { Button, ConfigProvider, Segmented, Spin, theme, Typography } from 'antd'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LuLockOpen, LuLogIn, LuMapPin, LuSquarePen } from 'react-icons/lu'

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
import { panelVariants } from './internal/motion'
import { type GeneralSettings, type PortalFilters } from './shared/types'

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
  const { token } = theme.useToken()

  const [form, setForm] = useState<GeneralSettings>(generalSettings)
  const [authForm, setAuthForm] = useState<AuthSettings>(authSettings)
  const [slugInput, setSlugInput] = useState('')
  const [activeTab, setActiveTab] = useState('branding')
  const [participants, setParticipants] = useState<Record<string, SaveParticipant>>({})

  // Cards whose values live behind another endpoint join this page's Save
  // rather than carrying a button of their own — see useSaveParticipant.
  const reportParticipant = useCallback((key: string, participant?: SaveParticipant) => {
    setParticipants(prev => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([name]) => name !== key))
      return participant ? { ...rest, [key]: participant } : rest
    })
  }, [])
  const dirtyParticipants = useMemo(
    () => Object.values(participants).filter(participant => participant.isDirty),
    [participants]
  )

  useEffect(() => {
    setForm(generalSettings)
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

  // Across the whole page, not per tab: Save writes all of it at once, so this
  // is the one question the button has to answer.
  const isDirty = useMemo(
    () =>
      !isSame(form, generalSettings) ||
      !isSame(authForm, authSettings) ||
      slugInput.trim() !== portalPage.slug ||
      dirtyParticipants.length > 0,
    [form, generalSettings, authForm, authSettings, slugInput, portalPage.slug, dirtyParticipants]
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
      // After the page's own writes, so `results[2]` above stays the slug's.
      await Promise.all(dirtyParticipants.map(participant => participant.save()))
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
    refetchPortalPage,
    dirtyParticipants
  ])

  const isSaving = isUpdatingGeneralSettings || isUpdatingAuthSettings
  const disabled = isSaving

  const tabs = [
    {
      children: (
        <>
          <BrandingSection
            disabled={disabled}
            form={form}
            onCopy={copy}
            onPatch={patch}
            portalUrl={portalPage.url}
          />
          {BrandingExtras && <BrandingExtras />}
        </>
      ),
      icon: <LuSquarePen aria-hidden className="bc-shrink-0" size={16} />,
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
      icon: <LuMapPin aria-hidden className="bc-shrink-0" size={16} />,
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
      icon: <LuLockOpen aria-hidden className="bc-shrink-0" size={16} />,
      key: 'access',
      label: __('Access')
    },
    {
      children: <AuthSection disabled={disabled} form={authForm} onCopy={copy} onPatch={patchAuth} />,
      icon: <LuLogIn aria-hidden className="bc-shrink-0" size={16} />,
      key: 'auth',
      label: __('Sign in')
    }
  ]

  // Built once, apart from `tabs`: the panels change on every keystroke, and
  // new option nodes mid-switch cut antd's thumb slide short. The bold copy is
  // invisible and only holds width, so the open tab turning semibold does not
  // nudge its neighbours sideways.
  const tabOptions = useMemo(
    () =>
      tabs.map(tab => ({
        label: (
          <span className="bc-flex bc-items-center bc-gap-2 bc-leading-none">
            {tab.icon}
            <span className="bc-grid">
              <span aria-hidden className="bc-invisible bc-col-start-1 bc-row-start-1 bc-font-semibold">
                {tab.label}
              </span>
              <span className="bc-col-start-1 bc-row-start-1">{tab.label}</span>
            </span>
          </span>
        ),
        value: tab.key
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- icons and labels never change after mount
    []
  )

  return (
    // `reducedMotion="user"` rather than a per-component check: everything on
    // this page keeps its opacity fades but stops moving for anyone whose
    // system asks for that.
    <PageSaveContext.Provider value={reportParticipant}>
    <MotionConfig reducedMotion="user">
      <div className="bc-px-6 bc-pb-6">
        <div className="bc-min-w-0 bc-pb-4 bc-pt-5">
          <Title className="bc-mb-0.5" level={3}>
            {__('General')}
          </Title>
          <Text className="bc-text-xs" type="secondary">
            {__("Set up your community's name, address, who can see it, and how members sign in.")}
          </Text>
        </div>

        {/* Save sits on the tab row rather than after the panels: an edit made
            on one tab has to stay savable from any other. */}
        <div className="bc-mb-4 bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3">
          {/* A filled pill for the open tab, so the bar reads as a switch
              between panels rather than as links. */}
          <ConfigProvider
            theme={{
              components: {
                Segmented: {
                  // Hover a shade lighter than antd's, so it reads as a hint
                  // and never as a second open tab beside the blue one.
                  itemActiveBg: token.colorFillSecondary,
                  itemHoverBg: token.colorFillTertiary,
                  itemHoverColor: token.colorText,
                  itemSelectedBg: token.colorPrimary,
                  itemSelectedColor: token.colorTextLightSolid,
                  trackBg: 'var(--bc-surface)',
                  trackPadding: 8
                }
              },
              // A 36px pill (controlHeight less the track padding each side)
              // and 20px either side of each label, as in the design. Radii
              // here rather than as classes, which antd's own styles outrank:
              // the bar near the cards' 13px, the pill rounder than a button
              // and close to concentric with the bar across its 8px padding.
              token: {
                borderRadius: 14,
                borderRadiusSM: 8,
                controlHeight: 52,
                controlPaddingHorizontal: 21,
                // The thumb slide: longer than the app's 0.2s, on a long,
                // soft ease-out, so it leaves at once and glides to a stop
                // instead of snapping into place. Colour (label and hover)
                // stays quick: antd marks the tab selected only once the
                // thumb lands, so a slow fade would leave dark text sitting
                // on the blue pill after it arrives.
                motionDurationMid: '0.15s',
                motionDurationSlow: '0.45s',
                motionEaseInOut: 'cubic-bezier(0.32, 0.72, 0, 1)'
              }
            }}
          >
            <Segmented
              // The label is antd's fixed-height box; as a flex row it centres
              // the icon row in it, where a block row pins to its top. The open
              // tab's weight comes from antd's own selected class, not from
              // state, so switching tabs does not rebuild the options while
              // the thumb is still sliding. A 4px gap between items keeps a
              // hovered tab's fill from running into the open one.
              className="bc-max-w-full bc-overflow-x-auto bc-border bc-border-solid bc-border-line [&_.ant-segmented-item-label]:bc-flex [&_.ant-segmented-item-label]:bc-items-center [&_.ant-segmented-item-selected]:bc-font-semibold [&_.ant-segmented-group]:bc-gap-1"
              onChange={value => setActiveTab(value)}
              options={tabOptions}
              value={activeTab}
            />
          </ConfigProvider>

          <div className="bc-flex bc-shrink-0 bc-items-center bc-gap-3">
            {isDirty && <Text type="secondary">{__('Unsaved changes')}</Text>}
            <Button disabled={disabled || !isDirty} loading={isSaving} onClick={handleSave} type="primary">
              {__('Save')}
            </Button>
          </div>
        </div>

        {/* One panel out before the next comes in, in the same place: two
            forms crossing over each other read as one broken one. */}
        <AnimatePresence initial={false} mode="wait">
          <motion.div animate="in" exit="out" initial="out" key={activeTab} variants={panelVariants}>
            {tabs.find(tab => tab.key === activeTab)?.children}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
    </PageSaveContext.Provider>
  )
}
