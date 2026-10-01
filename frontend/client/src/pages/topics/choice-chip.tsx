import { cn } from '@common/helpers/globalHelpers'
import { Drawer } from 'antd'
import { useState } from 'react'
import { LuCheck, LuChevronDown } from 'react-icons/lu'
import { Link } from 'react-router'

export interface Choice {
  isSelected: boolean
  label: string
  to: string
}

export const CHIP_CLASS = cn([
  'bc-flex bc-h-8 bc-min-w-0 bc-max-w-[60%] bc-shrink bc-cursor-pointer bc-items-center bc-gap-1 bc-rounded-full bc-border-none bc-px-3',
  'bc-bg-surface-raised bc-text-[13px] bc-font-semibold bc-text-ink',
  'bc-transition-colors bc-duration-200 bc-ease-out hover:bc-bg-surface-hover active:bc-scale-95'
])

/**
 * A chip naming one part of what the listing shows — the stage, say — that
 * opens a bottom sheet of the others to switch to. Each row is the link the
 * sidebar would give for it, so the sheet and the drawer never disagree.
 */
export default function ChoiceChip({ choices, title }: { choices: Choice[]; title: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const current = choices.find(choice => choice.isSelected)?.label ?? title

  return (
    <>
      <button aria-haspopup="dialog" className={CHIP_CLASS} onClick={() => setIsOpen(true)} type="button">
        <span className="bc-min-w-0 bc-truncate">{current}</span>
        <LuChevronDown aria-hidden className="bc-shrink-0 bc-text-ink-subtle" size={14} strokeWidth={2.5} />
      </button>

      <Drawer
        height="auto"
        onClose={() => setIsOpen(false)}
        open={isOpen}
        placement="bottom"
        styles={{
          body: { maxHeight: '70dvh', overflowY: 'auto', padding: 8 },
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 }
        }}
        title={title}
      >
        <nav className="bc-flex bc-flex-col">
          {choices.map(choice => (
            <Link
              aria-current={choice.isSelected ? 'page' : undefined}
              className={cn([
                'bc-flex bc-h-12 bc-items-center bc-justify-between bc-gap-3 bc-rounded-lg bc-px-3 bc-text-base bc-no-underline',
                'hover:bc-bg-surface-sunken',
                choice.isSelected ? 'bc-font-semibold bc-text-primary' : 'bc-text-ink'
              ])}
              key={choice.to}
              onClick={() => setIsOpen(false)}
              to={choice.to}
            >
              <span className="bc-min-w-0 bc-truncate">{choice.label}</span>
              {choice.isSelected && <LuCheck aria-hidden className="bc-shrink-0" size={18} />}
            </Link>
          ))}
        </nav>
      </Drawer>
    </>
  )
}
