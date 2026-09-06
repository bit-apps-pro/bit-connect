import { Button } from 'antd'
import { LuArrowLeft, LuCompass, LuHouse } from 'react-icons/lu'
import { useNavigate } from 'react-router'

import { __ } from '../../common/helpers/i18nWrap'

/**
 * The portal's own not-found screen.
 *
 * Rendered inside the portal chrome on a real 404 response, so it has to read as
 * part of the community rather than as a server error page — the visitor still
 * has a header, a sidebar, and somewhere to go.
 *
 * "/" is router-relative: the basename already carries wherever the portal
 * lives, so this works both under a slug and at the site root. The previous
 * hard-coded "/portal" resolved to /portal/portal once the basename was applied,
 * and it ran on mount — so the screen redirected away before it could be read.
 */
export default function Error404() {
  const navigate = useNavigate()

  return (
    <div className="bc-flex bc-w-full bc-items-center bc-justify-center bc-px-4 bc-py-14 sm:bc-py-20">
      <div className="bc-w-full bc-max-w-md bc-text-center">
        <div className="bc-flex bc-flex-col bc-items-center bc-gap-5">
          <span className="bc-flex bc-h-16 bc-w-16 bc-items-center bc-justify-center bc-rounded-full bc-bg-primary/10 bc-text-primary dark:bc-bg-primary/20">
            <LuCompass size={30} />
          </span>

          <div className="bc-flex bc-flex-col bc-gap-2">
            <span className="bc-text-xs bc-font-semibold bc-uppercase bc-tracking-[0.2em] bc-text-ink-subtle">
              {__('404')}
            </span>
            <h1 className="bc-m-0 bc-text-2xl bc-font-semibold bc-text-ink sm:bc-text-3xl">
              {__('We can’t find that page')}
            </h1>
            <p className="bc-m-0 bc-text-sm bc-leading-relaxed bc-text-ink-subtle sm:bc-text-base">
              {__(
                'The link may be broken, or the topic could have been moved or removed. Everything else in the community is still here.'
              )}
            </p>
          </div>

          {/* Stacked and full-width on phones so each action is a comfortable
              target; side by side once there is room for both. */}
          <div className="bc-mt-2 bc-flex bc-w-full bc-flex-col bc-gap-3 sm:bc-w-auto sm:bc-flex-row">
            <Button
              icon={<LuHouse />}
              onClick={() => navigate('/', { replace: true })}
              size="large"
              type="primary"
            >
              {__('Back to the community')}
            </Button>
            <Button icon={<LuArrowLeft />} onClick={() => navigate(-1)} size="large">
              {__('Go back')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
