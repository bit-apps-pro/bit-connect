import { type ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Devtools({ reactQuery }: { reactQuery?: boolean }) {
  const [DevtoolsComponents, setDevtoolsComponents] = useState<ReactNode | undefined>()

  useEffect(() => {
    if (import.meta.env.DEV && reactQuery) {
      import('@tanstack/react-query-devtools').then(({ ReactQueryDevtools }) => {
        setDevtoolsComponents(<ReactQueryDevtools initialIsOpen={false} position="bottom" />)
      })
    }
  }, [reactQuery])

  if (!import.meta.env.DEV) return

  return DevtoolsComponents ? createPortal(DevtoolsComponents, document.body) : undefined
}
