import { __ } from '@common/helpers/i18nWrap'
import { combineSaves, flushAll, PageSaveContext, usePageSaves } from '@common/hooks/page-save'
import useAutoSave from '@common/hooks/use-auto-save'
import useRouteTab from '@common/hooks/use-route-tab'
import useCopyToClipboard from '@common/hooks/useCopyToClipboard'
import SaveStatus from '@utilities/save-status'
import { ConfigProvider, Segmented, theme, Typography } from 'antd'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
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

const { Title } = Typography

const TAB_KEYS = ['branding', 'location', 'access', 'auth'] as const

export default function General() {
  const { generalSettings, isGeneralSettingsPending } = useGeneralSettings()
  const { updateGeneralSettings } = useUpdateGeneralSettings()
  const { authSettings, isAuthSettingsPending } = useAuthSettings()
  const { updateAuthSettings } = useUpdateAuthSettings()
  const { isPortalPagePending, portalPage, refetchPortalPage } = usePortalPage()
  const { updatePortalSlug } = useUpdatePortalSlug()
  const { copy } = useCopyToClipboard()
  const { token } = theme.useToken()

  const [form, setForm] = useState<GeneralSettings>(generalSettings)
  const [authForm, setAuthForm] = useState<AuthSettings>(authSettings)
  const [slugInput, setSlugInput] = useState('')
  // In the address, so a refresh keeps the open tab and a tab can be linked to.
  const { activeTab, setActiveTab } = useRouteTab('/general', TAB_KEYS)

  // Cards whose values live behind another endpoint save themselves and report
  // here, so the one status line covers them too.
  const { report, states } = usePageSaves()

  // No toast when the new slug has no page behind it: the Location card says
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
  const generalSave = useAutoSave({
    draft: form,
    save: updateGeneralSettings,
    saved: isGeneralSettingsPending ? undefined : generalSettings,
    setDraft: setForm
  })
  const authSave = useAutoSave({
    draft: authForm,
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
    save: saveSlug,
    saved: isPortalPagePending ? undefined : portalPage.slug,
    serialize: slug => slug.trim(),
    setDraft: setSlugInput,
    validate: slug => (slug.trim() === '' ? __('Portal slug is required') : undefined)
  })
  const allSaves = [
    { ...generalSave, flush: generalSave.flushNow },
    { ...authSave, flush: authSave.flushNow },
    { ...slugSave, flush: slugSave.flushNow },
    ...states
  ]
  const pageSave = combineSaves(allSaves)
  // Leaving any field saves at once, rather than waiting out the delay. The
  // slug included: leaving its field is exactly when it is meant to save.
  const saveAll = () => flushAll(allSaves)

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
          onSlugCommit={() => slugSave.flush()}
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
    <PageSaveContext.Provider value={report}>
    <MotionConfig reducedMotion="user">
      <div className="bc-px-6 bc-pb-6" onBlur={saveAll}>
        <div className="bc-min-w-0 bc-pb-4 bc-pt-5">
          <Title className="bc-mb-0" level={3}>
            {__('General')}
          </Title>
        </div>

        {/* The status sits on the tab row rather than after the panels: it
            speaks for every tab, the ones not open included. */}
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
              onChange={setActiveTab}
              options={tabOptions}
              value={activeTab}
            />
          </ConfigProvider>

          <SaveStatus {...pageSave} onRetry={saveAll} />
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
