import { atom } from 'jotai'

/**
 * This atom is used to navigate
 * to a specific route outside react component.
 * jotai state can be access from pure function but
 * react-router hook `useNavigate` can't be used outside react component.
 */

const $navigate = atom('')
export default $navigate
