import { lazy, Suspense, useEffect } from 'react'
import { useNetworkState } from 'react-use'

// The banner is its own chunk, so antd's Alert is not in the first download
// for a state most visits never reach. It cannot be fetched once the visitor
// is offline, though — so the download starts as soon as the app has mounted,
// and the banner renders from the cache when the connection drops.
const loadOfflineAlert = () => import('./offline-alert')
const OfflineAlert = lazy(loadOfflineAlert)

export default function OfflineBanner() {
  const { online } = useNetworkState()

  useEffect(() => {
    loadOfflineAlert().catch(() => {
      // Nothing to show: the banner simply will not appear.
    })
  }, [])

  if (online) {
    return <></>
  }

  return (
    <Suspense>
      <OfflineAlert />
    </Suspense>
  )
}
