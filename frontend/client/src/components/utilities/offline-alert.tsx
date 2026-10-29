import { Alert } from 'antd'

/** The banner itself — see OfflineBanner for why it is a module of its own. */
export default function OfflineAlert() {
  return (
    <div>
      <Alert message="No internet! Please check your network connection." showIcon type="error" />
    </div>
  )
}
