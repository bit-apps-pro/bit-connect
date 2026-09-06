import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

export interface PortalPage {
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
  /** The portal owns the WordPress install root instead of a slug. */
  root: boolean
  slug: string
  url: string
}

const defaultPortalPage: PortalPage = {
  configured: false,
  editUrl: '',
  exists: false,
  frontPageOk: false,
  hasShortcode: false,
  root: false,
  slug: '',
  url: ''
}

export default function usePortalPage() {
  const { data, refetch } = useQuery<ResponseType<PortalPage>, Error, PortalPage>({
    queryFn: ({ signal }) => request<never, PortalPage>('portal-page', { method: 'GET', signal }),
    queryKey: ['portal-page'],
    retry: false,
    select: response => response?.data ?? (response as unknown as PortalPage)
  })

  return {
    portalPage: data ?? defaultPortalPage,
    refetchPortalPage: refetch
  }
}
