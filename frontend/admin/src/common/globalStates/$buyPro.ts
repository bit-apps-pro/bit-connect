import { atom } from 'jotai'

/**
 * Whether the Buy Pro modal is open.
 *
 * A single global rather than per-screen modal state: every locked preview in
 * the app opens the same one, and the modal is mounted once beside the router
 * so opening it never depends on which page happens to be rendered.
 */
export const $isBuyProModalOpen = atom<boolean>(false)
