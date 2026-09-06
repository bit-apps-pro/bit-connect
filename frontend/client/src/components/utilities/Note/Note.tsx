import { type ReactNode } from 'react'
import { useEffect } from 'react'
import Markdown from 'react-markdown'

import { cn } from '../../../common/helpers/globalHelpers'

export interface NotePropsType {
  className?: string
  note: string | string[]
  onRender?: (e?: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface ComponentType {
  children: ReactNode
  href?: string
}

const components: Record<string, React.FC<ComponentType>> = {
  a: ({ children, href }: ComponentType) => (
    <a
      className="bc-text-blue-500 bc-decoration-wavy hover:bc-underline"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  code: ({ children }: ComponentType) => (
    <code className="bc-rounded bc-bg-surface-raised bc-p-1 bc-text-ink">{children}</code>
  ),
  h1: ({ children }: ComponentType) => (
    <h1 className="bc-text-sm bc-font-bold bc-text-ink-muted">{children}</h1>
  ),
  h2: ({ children }: ComponentType) => (
    <h2 className="bc-text-sm bc-font-bold bc-text-ink-muted">{children}</h2>
  ),
  h3: ({ children }: ComponentType) => (
    <h3 className="bc-text-sm bc-font-bold bc-text-ink-muted">{children}</h3>
  ),
  hr: () => <hr className="bc-my-2 bc-border-b-0 bc-border-t bc-border-line-strong" />,
  p: ({ children }: ComponentType) => <p className="bc-m-0 bc-text-ink-muted">{children}</p>
}

export default function Note({ className, note, onRender }: NotePropsType) {
  useEffect(() => {
    onRender?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const content = Array.isArray(note) ? note.join('\n') : note

  return (
    <div
      className={cn([
        'bc-rounded bc-border bc-border-solid bc-px-2 bc-py-1 bc-text-sm',
        'bc-border-line bc-bg-surface-raised bc-text-ink-muted',
        className
      ])}
    >
      <Markdown components={components}>{content}</Markdown>
    </div>
  )
}
