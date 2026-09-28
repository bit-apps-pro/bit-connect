interface FieldLabelProps {
  children: React.ReactNode
}

/** The small caption above a field, shared by every card on this page. */
export default function FieldLabel({ children }: FieldLabelProps) {
  return (
    <span className="bc-mb-1.5 bc-flex bc-items-center bc-gap-1 bc-text-xs bc-font-medium bc-text-ink-muted">
      {children}
    </span>
  )
}
