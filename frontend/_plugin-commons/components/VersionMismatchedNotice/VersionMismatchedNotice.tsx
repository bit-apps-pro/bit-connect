import { Alert } from 'antd'
import { LuOctagonAlert } from 'react-icons/lu'

/**
 * This component is used to show a notice when the plugin version is mismatched.
 */

export default function VersionMismatchedNotice() {
  return (
    <div>
      <Alert
        icon={<LuOctagonAlert size={20} />}
        message="Please update your both plugin to same version."
        showIcon
        style={{ display: 'inline-flex' }}
        type="error"
      />
    </div>
  )
}
