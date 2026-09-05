import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type UserProfile } from '../data/use-user-profile'

const updateProfile = vi.fn()
vi.mock('../data/use-update-profile', () => ({
  default: () => ({ isUpdatingProfile: false, updateProfile })
}))

const { default: ProfileDetailsForm } = await import('./profile-details-form')

/* eslint-disable unicorn/no-null -- mirrors the API payload, where an absent
   cover and no recorded activity both arrive as JSON null */
const profile: UserProfile = {
  avatar: '',
  badge: null,
  bio: 'Builds things on the weekend.',
  cover: null,
  display_name: 'Aiden Carter',
  has_custom_avatar: false,
  has_custom_cover: false,
  id: 7,
  last_active_at: null,
  registered_at: '2026-01-01 00:00:00',
  role_label: 'Member',
  slug: 'aiden-carter',
  social_links: { github: 'https://github.com/aiden' }
}
/* eslint-enable unicorn/no-null */

describe('ProfileDetailsForm', () => {
  beforeEach(() => {
    updateProfile.mockReset()
    updateProfile.mockResolvedValue({ data: { user: profile } })
  })
  afterEach(cleanup)

  it('seeds every field from the profile, including links the member left blank', () => {
    render(<ProfileDetailsForm profile={profile} />)

    expect(screen.getByLabelText('Display name')).toHaveValue('Aiden Carter')
    expect(screen.getByLabelText('Profile URL')).toHaveValue('aiden-carter')
    expect(screen.getByLabelText('Bio')).toHaveValue('Builds things on the weekend.')
    expect(screen.getByLabelText('GitHub')).toHaveValue('https://github.com/aiden')
    expect(screen.getByLabelText('Website')).toHaveValue('')
  })

  it('refuses to submit a blank display name', async () => {
    render(<ProfileDetailsForm profile={profile} />)

    await userEvent.clear(screen.getByLabelText('Display name'))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Please enter a display name')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('refuses to submit a link that is not a URL', async () => {
    render(<ProfileDetailsForm profile={profile} />)

    await userEvent.type(screen.getByLabelText('Website'), 'not a url')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Please enter a valid URL')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('sends every link key so a cleared one is erased rather than left behind', async () => {
    render(<ProfileDetailsForm profile={profile} />)

    await userEvent.clear(screen.getByLabelText('GitHub'))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile.mock.calls[0][0].links).toEqual({
      github: '',
      linkedin: '',
      mastodon: '',
      twitter: '',
      website: ''
    })
  })

  it('shows the slug the server stored rather than what was typed', async () => {
    updateProfile.mockResolvedValue({ data: { user: { ...profile, slug: 'aiden-c' } } })
    render(<ProfileDetailsForm profile={profile} />)

    const slug = screen.getByLabelText('Profile URL')
    await userEvent.clear(slug)
    await userEvent.type(slug, 'Aiden C')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(slug).toHaveValue('aiden-c'))
  })
})
