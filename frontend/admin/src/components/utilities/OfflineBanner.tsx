import { Alert } from 'antd'
import { useNetworkState } from 'react-use'

export default function OfflineBanner() {
  const { online } = useNetworkState()

  if (online) {
    return <></>
  }

  return (
    <div>
      <Alert message="No internet! Please check your network connection." showIcon type="error" />
    </div>
  )
}
