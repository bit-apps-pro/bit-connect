import { __ } from '@common/helpers/i18nWrap'
import { resolveIsDark, type ThemeMode } from '@shared/theme/theme-mode'
import useThemeSwitchRipple, { originFromEvent } from '@shared/theme/use-theme-switch-ripple'
import { Dropdown, Tooltip } from 'antd'
import { AnimatePresence, motion } from 'framer-motion'
import { useAtom, useAtomValue } from 'jotai'
import { useRef } from 'react'
import { LuMonitor, LuMoon, LuSun } from 'react-icons/lu'

import { $isDarkTheme, $themeMode } from '@/common/globalStates/$appConfig'
import { cn } from '@/common/helpers/globalHelpers'

/**
 * The theme control: a borderless segmented pill — Light · System · Dark —
 * where the chosen segment expands to show its name beside the icon while the
 * others stay icon-only. The label is the affordance: the control never needs
 * a legend, because the current state reads as a word, not as "whichever icon
 * looks pressed".
 *
 * A visible three-way switch rather than a menu behind an icon: all three
 * states show at once, so "system" is discoverable and reachable *back* after
 * someone tries dark once. System sits in the middle because it is the
 * spectrum's midpoint, not an afterthought.
 *
 * Below `md` (and only when not `block`) the pill gives way to a ghost icon
 * button that opens a menu of the three modes: in the phone header the pill is
 * the widest control on the row. A menu rather than a blind cycle button so
 * all three modes are still seen together when it opens — the discoverability
 * argument above, one tap deferred. The swap is CSS-only
 * (`bc-hidden md:bc-inline-flex`) because the client app is prerendered — a
 * JS breakpoint would flash the wrong control before hydration.
 *
 * The thumb is a framer `layoutId` element and the segments are `layout`
 * elements, so a selection slides *and stretches* the thumb into the newly
 * sized segment; the theme itself changes via the shared ripple. The pill is
 * a real radiogroup: one tab stop, arrow keys move the selection.
 */

const OPTIONS: { icon: React.ReactNode; label: string; value: ThemeMode }[] = [
  { icon: <LuSun size={16} />, label: __('Light'), value: 'light' },
  { icon: <LuMonitor size={16} />, label: __('System'), value: 'system' },
  { icon: <LuMoon size={16} />, label: __('Dark'), value: 'dark' }
]

const ARROW_STEP: Record<string, number | undefined> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1
}

const SEGMENT_SPRING = { bounce: 0.18, duration: 0.35, type: 'spring' as const }

interface ThemeToggleProps {
  /** Stretch the pill and its segments to the container's width, and keep the
      full pill at every viewport width (no menu collapse). */
  block?: boolean
  className?: string
}

export default function ThemeToggle({ block = false, className }: ThemeToggleProps) {
  const [mode, setMode] = useAtom($themeMode)
  const isDark = useAtomValue($isDarkTheme)
  const { ripple, startSwitch } = useThemeSwitchRipple()
  const segmentReferences = useRef<Partial<Record<ThemeMode, HTMLButtonElement | null>>>({})

  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex(option => option.value === mode)
  )
  const active = OPTIONS[activeIndex]

  const handleSelect = (key: ThemeMode, domEvent: { clientX?: number; clientY?: number }) => {
    if (key === mode) return
    const targetIsDark = resolveIsDark(key)
    // The mode always updates, but the ripple only runs when the rendered
    // theme actually changes (light -> system on a light OS changes nothing):
    // a disc in the current surface colour is invisible motion.
    if (targetIsDark === isDark) {
      setMode(key)
      return
    }
    startSwitch({
      apply: () => setMode(key),
      origin: originFromEvent(domEvent),
      targetIsDark
    })
  }

  // Radios select on arrow, not on tab: the group is one tab stop and focus
  // travels with the selection.
  const handleSegmentKeyDown = (event: React.KeyboardEvent) => {
    const step = ARROW_STEP[event.key]
    if (!step) return
    event.preventDefault()
    const next = OPTIONS[(activeIndex + step + OPTIONS.length) % OPTIONS.length]
    handleSelect(next.value, {})
    segmentReferences.current[next.value]?.focus()
  }

  return (
    <>
      {!block && (
        <Dropdown
          menu={{
            items: OPTIONS.map(({ icon, label, value }) => ({
              icon,
              key: value,
              label,
              onClick: ({ domEvent }: { domEvent: React.KeyboardEvent | React.MouseEvent }) =>
                handleSelect(value, 'clientX' in domEvent ? domEvent : {})
            })),
            selectable: true,
            selectedKeys: [mode]
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <button
            aria-label={`${__('Theme')}: ${active.label}`}
            className={cn([
              'bc-flex bc-h-8 bc-w-8 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded-lg bc-border-none bc-bg-transparent bc-p-0 bc-text-ink-muted bc-transition-colors md:bc-hidden',
              'hover:bc-bg-surface-sunken hover:bc-text-ink',
              'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40',
              className
            ])}
            type="button"
          >
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                className="bc-flex"
                exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
                initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
                key={mode}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >
                {active.icon}
              </motion.span>
            </AnimatePresence>
          </button>
        </Dropdown>
      )}
      <div
        aria-label={__('Colour theme')}
        className={cn([
          'bc-items-center bc-gap-0.5 bc-rounded-full bc-bg-surface-sunken bc-p-1',
          block ? 'bc-flex bc-w-full' : 'bc-hidden md:bc-inline-flex',
          className
        ])}
        role="radiogroup"
      >
        {OPTIONS.map(({ icon, label, value }, index) => {
          const isActive = index === activeIndex
          const segment = (
            <motion.button
              aria-checked={isActive}
              aria-label={label}
              className={cn([
                'bc-relative bc-flex bc-h-7 bc-cursor-pointer bc-items-center bc-justify-center bc-rounded-full bc-border-none bc-bg-transparent bc-p-0 bc-transition-colors',
                'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40',
                block && 'bc-flex-1',
                isActive
                  ? 'bc-gap-1.5 bc-px-2.5 bc-text-ink'
                  : 'bc-min-w-8 bc-text-ink-subtle hover:bc-text-ink-muted'
              ])}
              key={value}
              layout
              onClick={event => handleSelect(value, event)}
              onKeyDown={handleSegmentKeyDown}
              ref={element => {
                segmentReferences.current[value] = element
              }}
              role="radio"
              tabIndex={isActive ? 0 : -1}
              transition={SEGMENT_SPRING}
              type="button"
            >
              {isActive && (
                <motion.span
                  className={cn([
                    // Elevation, not a border: white lifts off the sunken
                    // track in light; on dark the two blacks are a step apart,
                    // so the thumb takes the raised surface instead.
                    'bc-absolute bc-inset-0 bc-rounded-full bc-bg-surface dark:bc-bg-surface-raised'
                  ])}
                  layoutId="theme-switch-thumb"
                  style={{ boxShadow: '0 1px 3px rgb(0 0 0 / 14%)' }}
                  transition={SEGMENT_SPRING}
                />
              )}
              <span className="bc-relative bc-flex">{icon}</span>
              {isActive && (
                <motion.span
                  animate={{ opacity: 1 }}
                  className="bc-relative bc-overflow-hidden bc-whitespace-nowrap bc-text-xs bc-font-semibold"
                  initial={{ opacity: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                >
                  {label}
                </motion.span>
              )}
            </motion.button>
          )
          // The active segment already says its name; a tooltip repeating it
          // would just chase the thumb around.
          return isActive ? (
            segment
          ) : (
            <Tooltip key={value} placement="top" title={label}>
              {segment}
            </Tooltip>
          )
        })}
      </div>
      {ripple}
    </>
  )
}
