import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert, Button, Input, Modal, Space, Switch, Tag, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useContext } from 'react'

import useCheckSlug from '../data/use-check-slug'
import useCreatePortalPage from '../data/use-create-portal-page'
import { type PortalPage } from '../data/use-portal-page'
import useUpdatePortalRoot from '../data/use-update-portal-root'
import { revealVariants } from './motion'
import SectionCard from './section-card'
import SettingRow from './setting-row'
import SlugStatus from './slug-status'

const { Text } = Typography

interface LocationSectionProps {
  disabled: boolean
  onCopy: (value: string) => void
  onSlugChange: (slug: string) => void
  /** Saves the slug: on leaving the field or pressing Enter, never mid-word. */
  onSlugCommit: () => void
  portalPage: PortalPage
  slug: string
}

/**
 * Where the portal lives. Three controls, nothing else:
 *
 *   slug       — which page carries the portal. A pointer: changing it never
 *                renames or moves a page, and the hint under the field says
 *                whether one is there. When none is, the card offers to
 *                create it, so a deleted page is one click from repaired.
 *   site root  — serve from `/` instead, making the page the homepage.
 *   own page   — for embedding by hand, as the block or the shortcode; a
 *                published page carrying either becomes the portal
 *                automatically when none is set.
 *
 * Slug and root mode both move every topic URL, so each says so before it is
 * touched, and root mode asks first.
 */
export default function LocationSection({
  disabled,
  onCopy,
  onSlugChange,
  onSlugCommit,
  portalPage,
  slug
}: LocationSectionProps) {
  const { notificationApi } = useContext(NotifyContext)
  // The hook, not the static Modal.confirm: a static call renders outside the
  // app's ConfigProvider and so in antd's stock font, colours and radii.
  const [modal, modalContextHolder] = Modal.useModal()
  const { isUpdatingPortalRoot, updatePortalRoot } = useUpdatePortalRoot()
  // Only checked once the value differs from what is saved: the saved slug's
  // state already comes with portalPage.
  const slugDirty = !portalPage.root && slug.trim() !== portalPage.slug
  const { check, isChecking } = useCheckSlug(slugDirty ? slug : '')
  const { createPortalPage, isCreatingPortalPage } = useCreatePortalPage()

  // The page goes where the field points: what is typed there, or the saved
  // slug when the field is untouched or has been emptied.
  const createSlug = slug.trim() || portalPage.slug
  // A typed slug is only offered once the check has cleared it for a new page.
  const typedSlugBlocked = slugDirty && (isChecking || check?.available === false)

  const handleCreatePage = useCallback(async () => {
    try {
      await createPortalPage(createSlug)
      // An emptied field is put back in step with the page it now has.
      onSlugChange(createSlug)
      notificationApi?.success({ message: __('Your community page has been created') })
    } catch (error: unknown) {
      notificationApi?.error({
        message: (error as { message?: string })?.message ?? __('Could not create the page')
      })
    }
  }, [createPortalPage, createSlug, notificationApi, onSlugChange])

  const applyRootMode = useCallback(
    async (enabled: boolean) => {
      try {
        await updatePortalRoot(enabled)
        notificationApi?.success({
          message: enabled
            ? __('The community is now your homepage')
            : __('The community is back on its own page')
        })
      } catch (error: unknown) {
        const msg =
          (error as { message?: string })?.message ?? __('Could not change the community address')
        notificationApi?.error({ message: msg })
      }
    },
    [updatePortalRoot, notificationApi]
  )

  // Changing the portal's location replaces the site's homepage and changes the
  // URL of every topic — links and search rankings included. Too consequential
  // to sit behind a single unguarded click.
  const handleToggleRoot = useCallback(
    (enabled: boolean) => {
      // No page, no homepage: say what is missing instead of a dead switch.
      if (enabled && !portalPage.exists) {
        notificationApi?.warning({
          description: __('Create the community page first, then turn this on.'),
          message: __('There is no community page yet')
        })
        return
      }
      modal.confirm({
        cancelText: __('Cancel'),
        content: enabled
          ? __(
              'Your current homepage is replaced by the community, and topic links change from /slug/topic to /topic. Links people already shared will stop working.'
            )
          : __(
              'The community goes back to yoursite.com/slug and topic links change again. Your homepage goes back to what it was before.'
            ),
        okText: enabled ? __('Yes, make it my homepage') : __('Yes, move it back'),
        onOk: () => applyRootMode(enabled),
        title: enabled
          ? __('Show the community as your homepage?')
          : __('Move the community back to its own page?'),
        width: 520
      })
    },
    [applyRootMode, modal, notificationApi, portalPage.exists]
  )

  return (
    <SectionCard
      subtitle={__('The address visitors land on, and the WordPress page that carries the portal.')}
      tag={
        // A small badge qualifying the title, not a control.
        <Tag
          className="bc-m-0 bc-px-1.5 bc-text-[10px] bc-leading-4"
          color={portalPage.exists ? (portalPage.root ? 'blue' : 'default') : 'warning'}
        >
          {portalPage.exists
            ? portalPage.root
              ? __('Site root')
              : __('Own page')
            : __('Not set up')}
        </Tag>
      }
      title={__('Portal address')}
    >
      {modalContextHolder}
      {/* These appear and disappear in response to a control further down the
          card, so they open the space they need instead of shoving the rows
          under them out of the way. */}
      <AnimatePresence initial={false}>
        {!portalPage.exists && (
          <motion.div
            animate="show"
            className="bc-overflow-hidden"
            exit="exit"
            initial="hidden"
            key="no-page"
            variants={revealVariants}
          >
            <Alert
              action={
                portalPage.canCreatePage &&
                createSlug !== '' && (
                  <Button
                    disabled={disabled || Boolean(typedSlugBlocked)}
                    loading={isCreatingPortalPage}
                    onClick={handleCreatePage}
                    size="small"
                    type="primary"
                  >
                    {sprintf(__('Create page at /%s'), createSlug)}
                  </Button>
                )
              }
              className="bc-mb-3 bc-mt-2 bc-py-2 bc-text-sm"
              message={
                portalPage.configured
                  ? __(
                      'There is no published page at this address, so your community cannot be reached. Create the page, or change the slug below to a page that contains the Bit Connect block or shortcode.'
                    )
                  : __(
                      'No community page yet. Enter an address slug below and create the page, or add the Bit Connect block or shortcode to a page of your own and publish it.'
                    )
              }
              showIcon
              type="warning"
            />
          </motion.div>
        )}

        {!portalPage.prettyPermalinks && (
          <motion.div
            animate="show"
            className="bc-overflow-hidden"
            exit="exit"
            initial="hidden"
            key="permalinks"
            variants={revealVariants}
          >
            <Alert
              action={
                portalPage.permalinksUrl && (
                  <Button href={portalPage.permalinksUrl} size="small">
                    {__('Open Permalinks')}
                  </Button>
                )
              }
              className="bc-mb-3 bc-mt-2 bc-py-2 bc-text-sm"
              message={__(
                'Your site uses plain permalinks, so community addresses will not open. Choose any other structure in Settings → Permalinks.'
              )}
              showIcon
              type="error"
            />
          </motion.div>
        )}

        {portalPage.root && !portalPage.frontPageOk && (
          <motion.div
            animate="show"
            className="bc-overflow-hidden"
            exit="exit"
            initial="hidden"
            key="front-page"
            variants={revealVariants}
          >
            <Alert
              className="bc-mb-3 bc-mt-2 bc-py-2 bc-text-sm"
              message={__(
                'Your homepage is not set to the community page. Choose it in Settings → Reading, or turn off "Serve at the site root".'
              )}
              showIcon
              type="error"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {portalPage.exists && (
        <SettingRow
          description={__('Where your community can be reached right now.')}
          full
          label={__('Live address')}
        >
          <div className="bc-flex bc-flex-wrap bc-items-center bc-gap-3">
            <Space.Compact className="bc-w-80 bc-max-w-full">
              <Input readOnly value={portalPage.url} />
              <Button onClick={() => onCopy(portalPage.url)} type="primary">
                {__('Copy')}
              </Button>
            </Space.Compact>
            {portalPage.editUrl && (
              <a className="bc-text-sm" href={portalPage.editUrl} rel="noreferrer" target="_blank">
                {__('Edit this page')}
              </a>
            )}
          </div>
        </SettingRow>
      )}

      <SettingRow
        description={
          portalPage.root
            ? __('Your community is your homepage, so it has no slug of its own.')
            : __(
                'The last part of the address, e.g. yoursite.com/community. It must match the slug of the page that shows the community. Changing it changes every topic link.'
              )
        }
        label={__('Address slug')}
      >
        <div className="bc-grid bc-gap-2">
          <Input
            addonBefore="/"
            disabled={disabled || portalPage.root}
            onBlur={onSlugCommit}
            onChange={e => onSlugChange(e.target.value)}
            onPressEnter={onSlugCommit}
            placeholder={__('e.g. community')}
            value={portalPage.root ? '' : slug}
          />
          {slugDirty && <SlugStatus check={check} isChecking={isChecking} mode="point" />}
          {!slugDirty && portalPage.exists && !portalPage.hasShortcode && (
            <Text className="bc-text-sm" type="warning">
              {__(
                'This page does not contain the Bit Connect block or the [bit-connect] shortcode, so the community will not show on it.'
              )}
            </Text>
          )}
        </div>
      </SettingRow>

      <SettingRow
        description={__(
          'Serve the portal from the site root instead of a slug, so it becomes your homepage. Use this only if the whole WordPress site is for the forum.'
        )}
        inline
        label={__('Serve at the site root')}
      >
        <Switch
          aria-label={__('Serve at the site root')}
          checked={portalPage.root}
          disabled={disabled || isUpdatingPortalRoot || !portalPage.canSetFrontPage}
          loading={isUpdatingPortalRoot}
          onChange={handleToggleRoot}
        />
        <Text className="bc-text-xs" type="secondary">
          {portalPage.canSetFrontPage
            ? portalPage.exists
              ? __('Applies immediately')
              : __('Needs the page first')
            : __('Only a site administrator can change the homepage')}
        </Text>
      </SettingRow>

      <SettingRow
        description={__(
          'To show the community on a page of your own, add the "Bit Connect" block to it in the block editor. In any other editor or page builder, paste this shortcode instead. If you have no community page yet, the page you publish with either one becomes the community page.'
        )}
        label={__('Add to your own page')}
      >
        <Space.Compact className="bc-w-full">
          <Input readOnly value="[bit-connect]" />
          <Button onClick={() => onCopy('[bit-connect]')} type="primary">
            {__('Copy')}
          </Button>
        </Space.Compact>
      </SettingRow>
    </SectionCard>
  )
}
