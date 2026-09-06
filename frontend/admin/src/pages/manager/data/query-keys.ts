/**
 * The TanStack Query keys the Manager screen shares.
 *
 * Written down because they cross an edition boundary. The pro add-on's badge
 * mutations invalidate `users`, a key this free module owns, and they do it by
 * name — so once the two editions live in separate repositories a rename here
 * would leave the pro build invalidating a key nothing answers to. Badge
 * assignment would save, the table would go on showing the old badges, and
 * nothing would report an error. A shared factory turns that into a type error
 * instead.
 */
export const managerKeys = {
  capabilitySettings: () => ['capability-settings'] as const,
  profileBadges: () => ['profile-badges'] as const,
  /** Prefix covering every users query — what a mutation invalidates. */
  users: () => ['users'] as const,
  /** One page of the user list. Shares the `users` prefix above by construction. */
  usersPage: (page: number, perPage: number, search: string) =>
    [...managerKeys.users(), page, perPage, search] as const
}
