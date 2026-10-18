interface StaticValueProps {
  children: React.ReactNode
}

/**
 * A value this plugin states rather than asks for.
 *
 * Deliberately not an input, read-only or otherwise: a field that looks
 * editable and is not reads as a control that does nothing.
 */
export default function StaticValue({ children }: StaticValueProps) {
  return (
    <div className="bc-min-h-10 bc-break-words bc-rounded-lg bc-bg-surface-sunken bc-px-3 bc-py-2.5 bc-text-sm bc-text-ink">
      {children}
    </div>
  )
}
