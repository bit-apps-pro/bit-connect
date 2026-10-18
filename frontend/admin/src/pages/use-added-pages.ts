import { type AddedPage } from './added-page'

/**
 * Screens a plugin adds to this admin, each with its route and its nav entry.
 *
 * None here: every screen this plugin has is routed in AppRoutes and listed in
 * the Sidebar. A hook rather than a list, so a screen that depends on a setting
 * can appear the moment that setting is saved.
 */
export default function useAddedPages(): AddedPage[] {
  return []
}
