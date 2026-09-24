/**
 * Whether this forum has private topics at all.
 *
 * Read by surfaces that only need to know the feature exists — the topic filter
 * offers a Private option, say — rather than by anything that writes a status.
 * Not a setting read, because there is no setting: this plugin holds no code
 * that makes a topic private, so the answer cannot vary. Surfaces that offer a
 * Private affordance drop it entirely rather than show it disabled.
 *
 * Callers still handle "no, but this visitor is already looking at private
 * topics": a bookmark pointing at that filter has to keep rendering, and an
 * existing private topic is readable on any install whatever this says.
 */
export default function useHasPrivateTopics(): boolean {
  return false
}
