import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

export interface PortalPage {
  /** The current user may publish pages, so the screen can offer to create one. */
  canCreatePage: boolean
  /** The current user may change the site's homepage (core's Reading settings). */
  canSetFrontPage: boolean
  /** A slug is saved, whether or not a page still answers to it. */
  configured: boolean
  /** wp-admin edit link of the portal page, '' when there is none. */
  editUrl: string
  /** A published page actually carries the portal. */
  exists: boolean
  /** Root mode is on but the front page is no longer the portal page. */
  frontPageOk: boolean
  /** …and it contains the [bit-connect] shortcode. */
  hasShortcode: boolean
  /** wp-admin's Permalinks screen, '' when the current user cannot open it. */
  permalinksUrl: string
  /** The site has a permalink structure; with plain permalinks no slug address resolves. */
  prettyPermalinks: boolean
  /** The portal owns the WordPress install root instead of a slug. */
  root: boolean
  slug: string
  url: string
}

const defaultPortalPage: PortalPage = {
  canCreatePage: false,
  canSetFrontPage: false,
  configured: false,
  editUrl: '',
  exists: false,
  frontPageOk: false,
  hasShortcode: false,
  permalinksUrl: '',
  // Assumed fine until the server says otherwise, so the warning never flashes while loading.
  prettyPermalinks: true,
  root: false,
  slug: '',
  url: ''
}

export default function usePortalPage() {
  const { data, isPending, refetch } = useQuery<ResponseType<PortalPage>, Error, PortalPage>({
    queryFn: ({ signal }) => request<never, PortalPage>('portal-page', { method: 'GET', signal }),
    queryKey: ['portal-page'],
    retry: false,
    select: response => response?.data ?? (response as unknown as PortalPage)
  })

  return {
    isPortalPagePending: isPending,
    portalPage: data ?? defaultPortalPage,
    refetchPortalPage: refetch
  }
}
