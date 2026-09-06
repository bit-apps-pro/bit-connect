import { type ReactNode } from 'react'

interface IfProps {
  children: ReactNode
  // Else?: JSX.Element | string
  conditions?: unknown
}

export default function If({ children, conditions }: IfProps) {
  const isConditionsAreTrue = Array.isArray(conditions) ? conditions.every(Boolean) : Boolean(conditions)

  // const isTrue = keys.every(key => {
  //   if (
  //     (typeof key === 'string' || typeof key === 'number') &&
  //     restProps &&
  //     key in restProps &&
  //     restProps[key]
  //   ) {
  //     return true
  //   }

  if (isConditionsAreTrue) return children

  return
}
