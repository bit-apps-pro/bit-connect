<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\AdminSettings;
use BitApps\BitConnect\Enum\Capabilities;
use WP_Comment;
use WP_Post;

/**
 * High-level permission helpers for the forum.
 *
 * All checks delegate to WPKit's Capabilities::check() with forum_* capabilities.
 * Ownership checks verify post/comment authorship before allowing the action.
 * Moderators bypass ownership when deleting, never when editing — see
 * canEditPost().
 *
 * Usage in controllers:
 *   if (!PermissionService::canCreatePost()) { ... }
 *   if (!PermissionService::canEditPost($postId)) { ... }
 */
final class PermissionService
{
    // -------------------------------------------------------------------------
    // Post authoring
    // -------------------------------------------------------------------------

    public static function canCreatePost(): bool
    {
        return WpCapabilities::check(Capabilities::CREATE_POST->value);
    }

    /**
     * Only the author edits a post, and only they ever can.
     *
     * There is no moderator override and no administrator override. A topic
     * carries its author's name, so a rewrite by anyone else changes what the
     * forum says that person said, and does it silently. Moderation acts by
     * removing content, which the author can see for themselves.
     *
     * Nothing here narrows by status either: the author may correct their own
     * topic whatever stage it has reached. The window that used to close at the
     * first status change existed alongside a moderator who could still fix the
     * topic afterwards; without that, it would leave answered topics frozen
     * with no one able to correct a mistake in them.
     */
    public static function canEditPost(int $postId): bool
    {
        if (!WpCapabilities::check(Capabilities::EDIT_OWN_POST->value)) {
            return false;
        }

        return self::currentUserOwnsPost($postId);
    }

    /**
     * User can delete a post if they own it (and have delete_own cap) OR hold
     * forum_delete_any.
     */
    public static function canDeletePost(int $postId): bool
    {
        if (WpCapabilities::check(Capabilities::DELETE_ANY->value)) {
            return true;
        }

        if (!WpCapabilities::check(Capabilities::DELETE_OWN_POST->value)) {
            return false;
        }

        return self::currentUserOwnsPost($postId);
    }

    // -------------------------------------------------------------------------
    // Comment authoring
    // -------------------------------------------------------------------------

    public static function canCreateComment(): bool
    {
        return WpCapabilities::check(Capabilities::CREATE_COMMENT->value);
    }

    /**
     * Only the author edits a comment. See canEditPost() for why.
     */
    public static function canEditComment(int $commentId): bool
    {
        if (!WpCapabilities::check(Capabilities::EDIT_OWN_COMMENT->value)) {
            return false;
        }

        return self::currentUserOwnsComment($commentId);
    }

    /**
     * User can delete a comment if they own it (and have delete_own cap) OR hold
     * forum_delete_any.
     */
    public static function canDeleteComment(int $commentId): bool
    {
        if (WpCapabilities::check(Capabilities::DELETE_ANY->value)) {
            return true;
        }

        if (!WpCapabilities::check(Capabilities::DELETE_OWN_COMMENT->value)) {
            return false;
        }

        return self::currentUserOwnsComment($commentId);
    }

    // -------------------------------------------------------------------------
    // Voting
    // -------------------------------------------------------------------------

    /**
     * Whether a topic may be created or kept private.
     *
     * Two gates, and both have to be open. The admin decides whether the forum
     * offers private topics at all (admin_settings.topicAccess.privateTopic),
     * and private topics are a pro feature, so an unlicensed site cannot switch
     * them on however the setting reads. Ordering matters only for cost: the
     * option read is cheaper than resolving the pro plugin.
     *
     * This is deliberately not a capability. Capabilities say what a *member*
     * may do; this says what the *forum* offers, which is a different question
     * and is why it is not in the Manager's per-role matrix.
     *
     * Existing private topics are untouched by this — turning it off stops new
     * ones being created, it does not publish or hide what is already there.
     */
    public static function canUsePrivateTopics(): bool
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);

        if (!\is_array($settings) || empty($settings['topicAccess']['privateTopic'])) {
            return false;
        }

        return ProFeatures::privateTopics();
    }

    /**
     * Whether the forum offers upvoting on comments at all.
     *
     * The same two gates as canUsePrivateTopics(), and the same reasoning: the
     * admin decides whether comment upvotes are offered
     * (admin_settings.topicAccess.commentUpvote), and comment upvoting is a pro
     * feature, so an unlicensed site cannot switch it on however the setting
     * reads.
     *
     * Not a capability. Capabilities::VOTE_COMMENT says whether *this member*
     * may vote; this says whether the forum has the feature — a different
     * question, asked before the capability is worth checking.
     *
     * Existing votes are untouched: turning this off stops new ones being cast
     * and stops the control being offered, it does not erase what was counted.
     */
    public static function canUseCommentUpvotes(): bool
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);

        if (!\is_array($settings) || empty($settings['topicAccess']['commentUpvote'])) {
            return false;
        }

        return ProFeatures::commentUpvotes();
    }

    public static function canVotePost(): bool
    {
        return WpCapabilities::check(Capabilities::VOTE_POST->value);
    }

    public static function canVoteComment(): bool
    {
        return WpCapabilities::check(Capabilities::VOTE_COMMENT->value);
    }

    // -------------------------------------------------------------------------
    // Moderation
    // -------------------------------------------------------------------------

    public static function canModerate(): bool
    {
        return WpCapabilities::check(Capabilities::MODERATE->value);
    }

    /**
     * Whether the user may delete content they did not write.
     *
     * There is no canEditAny() beside this, and that asymmetry is the design:
     * removal is visible to the author, a rewrite is not.
     */
    public static function canDeleteAny(): bool
    {
        return WpCapabilities::check(Capabilities::DELETE_ANY->value);
    }

    public static function canPinPost(): bool
    {
        return WpCapabilities::check(Capabilities::PIN_POST->value);
    }

    public static function canLockPost(): bool
    {
        return WpCapabilities::check(Capabilities::LOCK_POST->value);
    }

    // -------------------------------------------------------------------------
    // Administration
    // -------------------------------------------------------------------------

    public static function canManage(): bool
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    /**
     * Every forum capability, answered for the user making this request.
     *
     * Handed to the portal on bootstrap and by auth/me so its UI gates on the
     * same answers this class enforces. Without it the portal has to guess from
     * role names, which is wrong in both directions: caps are granted per role
     * in Manager, so a moderator can hold forum_moderate under any role slug,
     * and an administrator can have it taken away.
     *
     * Guests get every capability as false rather than an empty map, so the
     * caller never has to distinguish "not sent" from "not allowed".
     *
     * @return array<string, bool>
     */
    public static function currentUserCapabilities(): array
    {
        $capabilities = [];

        foreach (Capabilities::cases() as $capability) {
            $capabilities[$capability->value] = WpCapabilities::check($capability->value);
        }

        return $capabilities;
    }

    // -------------------------------------------------------------------------
    // Ownership helpers
    // -------------------------------------------------------------------------

    public static function currentUserOwnsPost(int $postId): bool
    {
        $post = get_post($postId);

        if (!$post instanceof WP_Post) {
            return false;
        }

        return (int) $post->post_author === get_current_user_id();
    }

    public static function currentUserOwnsComment(int $commentId): bool
    {
        $comment = get_comment($commentId);

        if (!$comment instanceof WP_Comment) {
            return false;
        }

        return (int) $comment->user_id === get_current_user_id();
    }

    // -------------------------------------------------------------------------
    // Contextual post-type permission check for topic access
    // -------------------------------------------------------------------------

    /**
     * Returns true when the user has any forum participation capability,
     * making them a forum participant (member, moderator, or admin).
     */
    public static function isForumParticipant(): bool
    {
        foreach (Capabilities::memberCaps() as $cap) {
            if (WpCapabilities::check($cap->value)) {
                return true;
            }
        }

        return false;
    }
}
