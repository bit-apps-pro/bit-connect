<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * Forum capabilities (backed enum).
 *
 * All permission checks go through WPKit's Capabilities::check() with the case
 * value, e.g. Capabilities::check(self::MANAGE->value). Never hard-code role names —
 * grant/revoke via CapabilityService settings.
 *
 * Labels live in #[Label] attributes (read via the EnumHelper trait). __()
 * cannot run inside attribute args, so wrap at the read site when a translated
 * string is needed: __($cap->label(), 'bit-connect').
 */
enum Capabilities: string
{
    use EnumHelper;

    // Content authoring
    #[Label('Create Topics/Posts')]
    case CREATE_POST = 'forum_create_post';

    #[Label('Edit Own Posts')]
    case EDIT_OWN_POST = 'forum_edit_own_post';

    #[Label('Delete Own Posts')]
    case DELETE_OWN_POST = 'forum_delete_own_post';

    #[Label('Create Comments/Replies')]
    case CREATE_COMMENT = 'forum_create_comment';

    #[Label('Edit Own Comments')]
    case EDIT_OWN_COMMENT = 'forum_edit_own_comment';

    #[Label('Delete Own Comments')]
    case DELETE_OWN_COMMENT = 'forum_delete_own_comment';

    // Voting
    #[Label('Vote on Posts')]
    case VOTE_POST = 'forum_vote_post';

    #[Label('Vote on Comments')]
    case VOTE_COMMENT = 'forum_vote_comment';

    // Content authority over other people's words
    /*
     * There is no edit-any capability, and adding one back is a product
     * decision rather than an oversight. A topic or comment carries its
     * author's name and avatar, so anyone able to rewrite it can change what
     * the forum says that person said. Removal is visible — the content is
     * plainly gone, and the author can see that for themselves. A silent
     * rewrite is not.
     *
     * Moderation here means taking something down, not changing what it says:
     * hide it, remove it, lock the thread, or resolve the report. If the words
     * need to change, the author changes them.
     */
    #[Label('Delete Any Content')]
    case DELETE_ANY = 'forum_delete_any';

    // Moderation
    /*
     * Running the forum, not rewriting it. This used to carry edit-any and
     * delete-any too, which meant a moderator could not be given the queue
     * without also being handed the power to reword anybody's post. Removal is
     * DELETE_ANY above; the power to reword no longer exists at all. What is
     * left here is reviewing reports, replying in a locked thread, and reading
     * another member's votes and permissions.
     */
    #[Label('Moderate (Reports, Locked Threads)')]
    case MODERATE = 'forum_moderate';

    #[Label('Pin/Unpin Topics')]
    case PIN_POST = 'forum_pin_post';

    #[Label('Lock/Unlock Topics')]
    case LOCK_POST = 'forum_lock_post';

    // Administration
    #[Label('Manage Forum Settings')]
    case MANAGE = 'forum_manage';

    /**
     * A capability this plugin used to grant and no longer recognises.
     *
     * Kept as a plain slug rather than a case because nothing may check for it
     * any more — currentUserCapabilities() walks cases(), so a case here would
     * put it back in the map the portal gates on. Its only remaining reader is
     * CapabilityService::revokeEditAny(), which strips it from sites that were
     * granted it before it was withdrawn.
     */
    public const WITHDRAWN_EDIT_ANY = 'forum_edit_any';

    /**
     * Capabilities granted to basic forum members.
     *
     * @return array<int, self>
     */
    public static function memberCaps(): array
    {
        return [
            self::CREATE_POST, self::EDIT_OWN_POST, self::DELETE_OWN_POST,
            self::CREATE_COMMENT, self::EDIT_OWN_COMMENT, self::DELETE_OWN_COMMENT,
            self::VOTE_POST, self::VOTE_COMMENT,
        ];
    }

    /**
     * Capabilities granted to forum moderators (includes member caps).
     *
     * Carries DELETE_ANY but no edit-any counterpart: a moderator can take
     * content down and cannot rewrite it. See the note on DELETE_ANY above.
     *
     * @return array<int, self>
     */
    public static function moderatorCaps(): array
    {
        return [
            ...self::memberCaps(),
            self::DELETE_ANY,
            self::MODERATE, self::PIN_POST, self::LOCK_POST,
        ];
    }

    /**
     * Capabilities that grant authority over content the user did not write.
     *
     * The set the upgrade hands to everyone who held MODERATE before it was
     * split, so nobody loses a power they had yesterday. Removal is the only
     * one left — forum_edit_any was withdrawn, and revokeEditAny() takes it
     * back from sites that were granted it by the earlier upgrade.
     *
     * @return array<int, self>
     */
    public static function contentAuthorityCaps(): array
    {
        return [self::DELETE_ANY];
    }

    /**
     * Full set of forum capabilities.
     *
     * @return array<int, self>
     */
    public static function adminCaps(): array
    {
        return self::cases();
    }

    /**
     * Turn a list of cases into a slug => true map (as stored in settings).
     *
     * @param array<int, self> $cases
     *
     * @return array<string, bool>
     */
    public static function capMap(array $cases): array
    {
        return array_fill_keys(array_map(static fn (self $case): string => $case->value, $cases), true);
    }

    /**
     * Legacy capability map: old bit_connect_* caps → new forum_* cap slugs.
     * Used by CapabilityService::migrateFromLegacyCaps().
     *
     * @return array<string, string[]>
     */
    public static function legacyMap(): array
    {
        return [
            'bit_connect_post'     => [self::CREATE_POST->value, self::EDIT_OWN_POST->value, self::DELETE_OWN_POST->value],
            'bit_connect_comment'  => [self::CREATE_COMMENT->value, self::EDIT_OWN_COMMENT->value, self::DELETE_OWN_COMMENT->value],
            'bit_connect_vote'     => [self::VOTE_POST->value, self::VOTE_COMMENT->value],
            'bit_connect_moderate' => [self::MODERATE->value, self::PIN_POST->value, self::LOCK_POST->value],
            'bit_connect_manage'   => [self::MANAGE->value],
        ];
    }
}
