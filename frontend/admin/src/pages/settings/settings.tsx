import { __ } from '@common/helpers/i18nWrap'
import { combineSaves, flushAll, PageSaveContext, usePageSaves } from '@common/hooks/page-save'
import useRouteTab from '@common/hooks/use-route-tab'
import PageTabs, { type PageTab } from '@utilities/page-tabs'
import SaveStatus from '@utilities/save-status'
import { Typography } from 'antd'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { type ReactNode, useMemo } from 'react'
import {
  LuBell,
  LuDatabase,
  LuGauge,
  LuGlobe,
  LuLogIn,
  LuMessageSquare,
  LuShieldCheck,
  LuTrendingUp
} from 'react-icons/lu'

import General from '../general/general'
import { panelVariants } from '../general/internal/motion'
import Notifications from '../notifications'
import Seo from '../seo'
import ForumSettings from './forum-settings'

const { Title } = Typography

// Ordered as an admin sets a forum up: the portal and how people get in, what
// they may do there, then what reaches them and search engines. Data last.
const TAB_KEYS = ['portal', 'sign-in', 'topics', 'moderation', 'limits', 'notifications', 'seo', 'data'] as const

type TabKey = (typeof TAB_KEYS)[number]

/**
 * Every setting the forum has, on one screen.
 *
 * They were four screens — General, Settings, Notifications and SEO — and an
 * admin had to guess which held a switch: who may read the portal sat under
 * General, whether new topics wait for approval under Settings. One screen
 * with a tab per subject leaves nothing to guess.
 *
 * Each tab saves as it changes and reports here under its own key, so the one
 * status line beside the title speaks for every tab, the ones not open
 * included.
 */
export default function Settings() {
  // In the address, so a refresh keeps the open tab and a tab can be linked to.
  const { activeTab, setActiveTab } = useRouteTab('/settings', TAB_KEYS)
  const { report, states } = usePageSaves()
  const pageSave = combineSaves(states)
  // Leaving any field saves at once, rather than waiting out the delay.
  const saveAll = () => flushAll(states)

  const tabs = useMemo<PageTab[]>(
    () => [
      { icon: <LuGlobe aria-hidden className="bc-shrink-0" size={16} />, key: 'portal', label: __('Portal') },
      { icon: <LuLogIn aria-hidden className="bc-shrink-0" size={16} />, key: 'sign-in', label: __('Sign in') },
      { icon: <LuMessageSquare aria-hidden className="bc-shrink-0" size={16} />, key: 'topics', label: __('Topics') },
      { icon: <LuShieldCheck aria-hidden className="bc-shrink-0" size={16} />, key: 'moderation', label: __('Moderation') },
      { icon: <LuGauge aria-hidden className="bc-shrink-0" size={16} />, key: 'limits', label: __('Limits') },
      { icon: <LuBell aria-hidden className="bc-shrink-0" size={16} />, key: 'notifications', label: __('Notifications') },
      { icon: <LuTrendingUp aria-hidden className="bc-shrink-0" size={16} />, key: 'seo', label: __('SEO') },
      { icon: <LuDatabase aria-hidden className="bc-shrink-0" size={16} />, key: 'data', label: __('Data') }
    ],
    []
  )

  const panels: Record<TabKey, ReactNode> = {
    data: <ForumSettings section="data" />,
    limits: <ForumSettings section="limits" />,
    moderation: <ForumSettings section="moderation" />,
    notifications: <Notifications />,
    portal: <General section="portal" />,
    seo: <Seo />,
    'sign-in': <General section="sign-in" />,
    topics: <ForumSettings section="topics" />
  }

  return (
    // `reducedMotion="user"` rather than a per-component check: everything on
    // this page keeps its opacity fades but stops moving for anyone whose
    // system asks for that.
    <PageSaveContext.Provider value={report}>
      <MotionConfig reducedMotion="user">
        <div className="bc-px-6 bc-pb-6" onBlur={saveAll}>
          <div className="bc-flex bc-flex-wrap bc-items-center bc-justify-between bc-gap-3 bc-pb-4 bc-pt-5">
            <Title className="bc-mb-0" level={3}>
              {__('Settings')}
            </Title>
            <SaveStatus {...pageSave} onRetry={saveAll} />
          </div>

          <div className="bc-mb-4">
            <PageTabs onChange={setActiveTab} tabs={tabs} value={activeTab} />
          </div>

          {/* One panel out before the next comes in, in the same place: two
              forms crossing over each other read as one broken one. */}
          <AnimatePresence initial={false} mode="wait">
            <motion.div animate="in" exit="out" initial="out" key={activeTab} variants={panelVariants}>
              {panels[activeTab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </MotionConfig>
    </PageSaveContext.Provider>
  )
}
