import { type ReactNode, useId, useState } from 'react'
import { LuChevronDown } from 'react-icons/lu'

import { cn } from '../../../../common/helpers/globalHelpers'

/**
 * A titled, collapsible group of sider links. The rows hang off a hairline down
 * their left edge, so the group reads as the heading's children rather than as
 * a second list that happens to follow the first.
 */
export default function NavSection({ children, title }: { children: ReactNode; title: string }) {
  const [isOpen, setIsOpen] = useState(true)
  const listId = useId()

  return (
    <section>
      <button
        aria-controls={listId}
        aria-expanded={isOpen}
        className={cn([
          'bc-flex bc-w-full bc-cursor-pointer bc-items-center bc-justify-between bc-rounded-md bc-border-none bc-bg-transparent bc-px-0 bc-py-2',
          'bc-text-xs bc-font-semibold bc-uppercase bc-tracking-wider bc-text-ink-muted hover:bc-text-ink',
          'bc-outline-none focus-visible:bc-ring-2 focus-visible:bc-ring-primary/40'
        ])}
        onClick={() => setIsOpen(open => !open)}
        type="button"
      >
        {title}
        <LuChevronDown
          aria-hidden
          className={cn(['bc-transition-transform bc-duration-200', !isOpen && '-bc-rotate-90'])}
          size={16}
        />
      </button>
      <div
        className="bc-mb-3 bc-mt-1 bc-space-y-1 bc-border-0 bc-border-l bc-border-solid bc-border-line bc-pl-3"
        hidden={!isOpen}
        id={listId}
      >
        {children}
      </div>
    </section>
  )
}
