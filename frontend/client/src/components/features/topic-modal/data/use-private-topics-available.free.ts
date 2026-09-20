/**
 * No private topics here.
 *
 * Not a setting read, because there is no setting: this plugin holds no code
 * that makes a topic private, so the answer cannot vary. Surfaces that offer a
 * Private affordance drop it entirely rather than show it disabled.
 */
export default function useHasPrivateTopicsFree(): boolean {
  return false
}
