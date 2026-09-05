import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type GeneralSettings } from '../shared/types'

const defaultGeneralSettings: GeneralSettings = {
  communityTitle: '',
  logoLight: '',
  logoPermalinkCustom: '',
  logoPermalinkMode: 'default',
  portalAccess: 'everyone',
  portalFilters: { product: true, sort: true, tags: true },
  promo: { cta: '', enabled: false, eyebrow: '', headline: '', phrases: [], prefix: '', url: '' }
}

export default function useGeneralSettings() {
  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<GeneralSettings>,
    Error,
    GeneralSettings
  >({
    queryFn: ({ signal }) =>
      request<never, GeneralSettings>('general-settings', { method: 'GET', signal }),
    queryKey: ['general-settings'],
    retry: false,
    select: response => {
      const d = response?.data ?? (response as unknown as GeneralSettings)
      return {
        communityTitle: d.communityTitle ?? defaultGeneralSettings.communityTitle,
        logoLight: d.logoLight ?? defaultGeneralSettings.logoLight,
        logoPermalinkCustom: d.logoPermalinkCustom ?? defaultGeneralSettings.logoPermalinkCustom,
        logoPermalinkMode: d.logoPermalinkMode ?? defaultGeneralSettings.logoPermalinkMode,
        portalAccess: d.portalAccess ?? defaultGeneralSettings.portalAccess,
        // Per-key rather than whole-object: an install saved before this
        // setting existed returns no portalFilters at all, and a partial object
        // must not blank out the keys it happens to omit.
        portalFilters: {
          product: d.portalFilters?.product ?? defaultGeneralSettings.portalFilters.product,
          sort: d.portalFilters?.sort ?? defaultGeneralSettings.portalFilters.sort,
          tags: d.portalFilters?.tags ?? defaultGeneralSettings.portalFilters.tags
        },
        promo: {
          cta: d.promo?.cta ?? '',
          // `=== true`, not `??`: an install that predates this setting, or a
          // stored '' from an older payload, must read as off. The card only
          // shows where someone deliberately turned it on.
          enabled: d.promo?.enabled === true,
          eyebrow: d.promo?.eyebrow ?? '',
          headline: d.promo?.headline ?? '',
          phrases: Array.isArray(d.promo?.phrases) ? d.promo.phrases : [],
          prefix: d.promo?.prefix ?? '',
          url: d.promo?.url ?? ''
        }
      }
    }
  })

  return {
    generalSettings: data ?? defaultGeneralSettings,
    isGeneralSettingsError: isError,
    isGeneralSettingsFetching: isFetching,
    isGeneralSettingsPending: isPending,
    refetchGeneralSettings: refetch
  }
}
