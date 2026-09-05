/* eslint-disable i18next/no-literal-string */
import { Alert } from 'antd'
import Link from 'antd/es/typography/Link'
import { LuCircleAlert } from 'react-icons/lu'

export function BitAppsPluginUtilUpdateNotice() {
  if (!import.meta.env.DEV) return

  if (typeof VITE_PLUGIN_HAS_SUBMODULE_UPDATES !== 'undefined' && VITE_PLUGIN_HAS_SUBMODULE_UPDATES) {
    return (
      <Alert
        closable
        css={{ padding: 10 }}
        description={
          <>
            <code>_bitapps-plugin-commons</code> submodule updated, please pull new changes from{' '}
            <Link href="https://github.com/Bit-Apps-Pro/_bitapps-plugin-commons" target="_blank">
              GitHub
            </Link>
            . If you already pulled the changes, please restart the dev server. and run{' '}
            <code>pnpm sync-plugin-commons</code> if needed.
          </>
        }
        icon={<LuCircleAlert />}
        message="Plugin Submodule Update Notice (Dev Only)"
        showIcon
        type="warning"
      />
    )
  }

  return
}
