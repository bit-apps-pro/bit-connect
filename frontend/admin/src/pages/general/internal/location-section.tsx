import NotifyContext from '@common/context/NotifyContext'
import { __, sprintf } from '@common/helpers/i18nWrap'
import { Alert, Input, Modal, Switch, Tag, Typography } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useContext } from 'react'

import useCheckSlug from '../data/use-check-slug'
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
  portalPage: PortalPage
  slug: string
}

/**
 * Where the portal lives. Three controls, nothing else:
 *
 *   slug       — which page carries the portal. A pointer only: the page is
 *                the administrator's to create or rename, and the hint under
 *                the field says whether one is there.
 *   site root  — serve from `/` instead, making the page the homepage.
 *   shortcode  — for embedding by hand; a published page carrying it becomes
 *                the portal automatically when none is set.
 *
 * Slug and root mode both move every topic URL, so each says so before it is
 * touched, and root mode asks first.
 */
export default function LocationSection({
  disabled,
  onCopy,
  onSlugChange,
  portalPage,
  slug
}: LocationSectionProps) {
  const { notificationApi } = useContext(NotifyContext)
  const { isUpdatingPortalRoot, updatePortalRoot } = useUpdatePortalRoot()
  // Only checked once the value differs from what is saved: the saved slug's
  // state already comes with portalPage.
  const slugDirty = !portalPage.root && slug.trim() !== portalPage.slug
  const { check, isChecking } = useCheckSlug(slugDirty ? slug : '')

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
          description: portalPage.configured
            ? sprintf(
                __('Create a page with the slug "%s" and the shortcode in it, then try again.'),
                portalPage.slug
              )
            : __('Add the shortcode to a page and publish it, then try again.'),
          message: __('There is no community page yet')
        })
        return
      }
      Modal.confirm({
        cancelText: __('Cancel'),
        content: enabled
          ? __(
              'Your current homepage is replaced by the community, and topic links change from /slug/topic to /topic. Links people already shared will stop working.'
            )
          : __(
              'The community goes back to yoursite.com/slug and topic links change again. Your homepage returns to the default WordPress posts page.'
            ),
        okText: enabled ? __('Yes, make it my homepage') : __('Yes, move it back'),
        onOk: () => applyRootMode(enabled),
        title: enabled
          ? __('Show the community as your homepage?')
          : __('Move the community back to its own page?'),
        width: 520
      })
    },
    [applyRootMode, notificationApi, portalPage.configured, portalPage.exists, portalPage.slug]
  )

  return (
    <SectionCard
      extra={
        portalPage.exists ? (
          <Tag color={portalPage.root ? 'blue' : 'default'}>
            {portalPage.root ? __('Homepage') : __('Own page')}
          </Tag>
        ) : (
          <Tag color="warning">{__('Not set up')}</Tag>
        )
      }
      subtitle={
        portalPage.exists ? (
          <>
            {__('Your community is at')}{' '}
            <a href={portalPage.url} rel="noreferrer" target="_blank">
              {portalPage.url}
            </a>
            {portalPage.editUrl && (
              <>
                {' · '}
                <a href={portalPage.editUrl} rel="noreferrer" target="_blank">
                  {__('Edit this page')}
                </a>
              </>
            )}
          </>
        ) : (
          __('The web address where people find your community.')
        )
      }
      title={__('Community address')}
    >
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
              className="bc-mb-3 bc-mt-2 bc-py-2 bc-text-sm"
              message={
                portalPage.configured
                  ? __(
                      'No published page at this address — create one with the shortcode in it, or change the slug below.'
                    )
                  : __(
                      'No page yet — add the shortcode below to a page and publish it to start the community.'
                    )
              }
              showIcon
              type="warning"
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
                'Your homepage is not the community page — pick it in Settings → Reading, or turn off "Show as homepage".'
              )}
              showIcon
              type="error"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <SettingRow
        description={
          portalPage.root
            ? __('Not used while the community is your homepage.')
            : __(
                'The last part of the address, e.g. yoursite.com/community. It must match the slug of the page that contains the shortcode. Changing it changes every topic link.'
              )
        }
        label={__('Address slug')}
      >
        <div className="bc-grid bc-gap-2">
          <Input
            addonBefore="/"
            disabled={disabled || portalPage.root}
            onChange={e => onSlugChange(e.target.value)}
            placeholder={__('e.g. community')}
            value={portalPage.root ? '' : slug}
          />
          {slugDirty && <SlugStatus check={check} isChecking={isChecking} mode="point" />}
          {!slugDirty && portalPage.exists && !portalPage.hasShortcode && (
            <Text className="bc-text-sm" type="warning">
              {__(
                'This page does not contain the [bit-connect] shortcode, so the community will not show on it.'
              )}
            </Text>
          )}
        </div>
      </SettingRow>

      <SettingRow
        description={__(
          'Show the community at yoursite.com instead of yoursite.com/slug. It replaces your current homepage — best for a site that is only the community.'
        )}
        label={__('Show as homepage')}
      >
        <div className="bc-flex bc-items-center bc-gap-3 md:bc-justify-end">
          <Switch
            checked={portalPage.root}
            disabled={disabled || isUpdatingPortalRoot}
            loading={isUpdatingPortalRoot}
            onChange={handleToggleRoot}
          />
          <Text className="bc-text-sm" type="secondary">
            {portalPage.exists ? __('Saves right away') : __('Needs the page first')}
          </Text>
        </div>
      </SettingRow>

      <SettingRow
        description={__(
          'Put this on any WordPress page to show the community there. If you have no community page yet, the page you publish with it becomes the community page.'
        )}
        label={__('Shortcode')}
      >
        <Input.Search
          enterButton={__('Copy')}
          onSearch={() => onCopy('[bit-connect]')}
          readOnly
          value="[bit-connect]"
        />
      </SettingRow>
    </SectionCard>
  )
}
