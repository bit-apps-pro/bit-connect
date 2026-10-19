import { request } from '@common/request'
import { type ResponseType } from '@common/request/types'
import { useQuery } from '@tanstack/react-query'

import { type AuthSettings } from '../shared/types'

const defaultAuthSettings: AuthSettings = {
  canRegister: true,
  customLoginUrl: '',
  customRegistrationUrl: '',
  loginPageCustomization: { banner: '', description: '', title: '' },
  loginPageUrl: '',
  membershipSettingsUrl: '',
  mode: 'plugin_default',
  redirectAfterLogin: '',
  redirectAfterLogout: '',
  registrationPageUrl: '',
  requireEmailVerification: false
}

export default function useAuthSettings() {
  const { data, isError, isFetching, isPending, refetch } = useQuery<
    ResponseType<AuthSettings>,
    Error,
    AuthSettings
  >({
    queryFn: ({ signal }) => request<never, AuthSettings>('auth-settings', { method: 'GET', signal }),
    queryKey: ['auth-settings'],
    retry: false,
    select: response => {
      const d = response?.data ?? response
      if (!d || typeof d !== 'object') return defaultAuthSettings
      const customization = d.loginPageCustomization ?? {}
      return {
        canRegister: d.canRegister ?? defaultAuthSettings.canRegister,
        customLoginUrl: d.customLoginUrl ?? '',
        customRegistrationUrl: d.customRegistrationUrl ?? '',
        loginPageCustomization: {
          banner: customization.banner ?? '',
          description: customization.description ?? '',
          title: customization.title ?? ''
        },
        loginPageUrl: d.loginPageUrl ?? '',
        membershipSettingsUrl: d.membershipSettingsUrl ?? '',
        mode: d.mode === 'custom_url' ? 'custom_url' : 'plugin_default',
        redirectAfterLogin: d.redirectAfterLogin ?? '',
        redirectAfterLogout: d.redirectAfterLogout ?? '',
        registrationPageUrl: d.registrationPageUrl ?? '',
        requireEmailVerification:
          d.requireEmailVerification ?? defaultAuthSettings.requireEmailVerification
      }
    }
  })

  return {
    authSettings: data ?? defaultAuthSettings,
    isAuthSettingsError: isError,
    isAuthSettingsFetching: isFetching,
    isAuthSettingsPending: isPending,
    refetchAuthSettings: refetch
  }
}
