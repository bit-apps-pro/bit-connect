import { Button, Result } from 'antd'
import { Component, type ReactNode } from 'react'

import { __ } from '../../common/helpers/i18nWrap'

/** When the last reload for a missing chunk was tried. */
const RELOAD_FLAG = 'bit-connect-chunk-reload'

const RETRY_WINDOW_MS = 10_000

/**
 * A screen's module could not be loaded — the build behind an open tab was
 * replaced by a plugin update, or the network dropped mid-navigation. Browsers
 * word this differently; these are Chrome's, Safari's and Firefox's.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(message)
}

interface State {
  failed: boolean
}

/**
 * Catches a screen that fails to render, so the sidebar and the rest of the
 * admin stay usable. Without it, one failed lazy import blanked the whole app
 * until a full reload.
 *
 * A missing chunk is retried with a reload, which fetches the current build;
 * anything else, or a miss right after a retry, shows a message with a Reload
 * button.
 * Keyed by screen where it is used, so moving to another screen clears it.
 */
export default class ScreenErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return

    // A time, not a flag: the boundary mounts before the lazy screen settles,
    // so nothing here can tell a reload that worked from one that did not.
    // A second miss within the window shows the message instead of looping.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0)
      if (Date.now() - last < RETRY_WINDOW_MS) return
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
    } catch {
      return
    }

    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <Result
        extra={
          <Button onClick={() => window.location.reload()} type="primary">
            {__('Reload')}
          </Button>
        }
        status="warning"
        subTitle={__('Reloading the page usually fixes this.')}
        title={__('This screen could not be loaded')}
      />
    )
  }
}
