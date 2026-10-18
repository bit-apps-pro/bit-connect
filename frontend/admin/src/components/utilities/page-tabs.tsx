import { theme } from 'antd'
import { motion } from 'framer-motion'
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react'

import { cn } from '../../common/helpers/globalHelpers'

export interface PageTab {
  icon: ReactNode
  key: string
  label: string
}

interface PageTabsProps {
  onChange: (key: string) => void
  tabs: PageTab[]
  value: string
}

/**
 * The tab bar a settings page switches its panels with: a filled pill for the
 * open tab, so it reads as a switch between panels rather than as links.
 *
 * One bar for every screen that has tabs — Settings, Tags, Topics — so moving
 * between them does not change how a tab looks.
 *
 * The pill moves the way the sidebar's does: a framer-motion `layoutId`
 * with framer's default spring, so the admin's two navs move alike.
 */
export default function PageTabs({ onChange, tabs, value }: PageTabsProps) {
  const { token } = theme.useToken()
  // Per bar, so two bars on one screen never trade a pill.
  const pillId = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // On a narrow screen the bar scrolls sideways, and the open tab could sit
  // past its edge with nothing to say it was there. Brought into view within
  // the bar only (`nearest`), so the page itself does not jump.
  const selectedIndex = tabs.findIndex(tab => tab.key === value)
  useEffect(() => {
    buttons.current[selectedIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedIndex])

  // Arrow keys move between tabs and open the one they land on, as a radio
  // group does.
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    buttons.current[next]?.focus()
    onChange(tabs[next].key)
  }

  return (
    <div
      className="bc-inline-flex bc-max-w-full bc-gap-1 bc-overflow-x-auto bc-rounded-[14px] bc-border bc-border-solid bc-border-line bc-p-2"
      role="tablist"
      style={{ background: 'var(--bc-surface)' }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.key === value

        return (
          <button
            aria-selected={selected}
            className={cn([
              'bc-relative bc-z-0 bc-flex bc-h-9 bc-shrink-0 bc-cursor-pointer bc-items-center bc-gap-2 bc-whitespace-nowrap bc-rounded-lg bc-border-0 bc-bg-transparent bc-px-5 bc-text-sm bc-leading-none bc-transition-colors',
              !selected && 'hover:bc-bg-surface-hover',
              'bc-ring-slate-900 focus-visible:bc-ring dark:bc-ring-slate-50'
            ])}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            onKeyDown={event => onKeyDown(event, index)}
            ref={node => {
              buttons.current[index] = node
            }}
            role="tab"
            style={{ color: selected ? token.colorTextLightSolid : token.colorText }}
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.icon}
            {/* The bold copy is invisible and only holds width, so the open
                tab turning semibold does not nudge its neighbours sideways. */}
            <span className="bc-grid">
              <span aria-hidden className="bc-invisible bc-col-start-1 bc-row-start-1 bc-font-semibold">
                {tab.label}
              </span>
              <span className={cn(['bc-col-start-1 bc-row-start-1', selected && 'bc-font-semibold'])}>{tab.label}</span>
            </span>

            {selected && (
              <motion.span
                className="bc-absolute bc-inset-0 bc--z-10 bc-rounded-lg"
                layoutId={`page-tab-pill-${pillId}`}
                style={{ background: token.colorPrimary }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
