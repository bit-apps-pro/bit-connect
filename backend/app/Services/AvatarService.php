<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use WP_Comment;
use WP_Post;
use WP_User;

/**
 * Custom profile pictures.
 *
 * WordPress has no built-in avatar upload — get_avatar() goes to Gravatar. This
 * stores an attachment id on the user and short-circuits WordPress's avatar
 * pipeline so the uploaded picture appears everywhere the portal already renders
 * one (topic cards, comments, the author rail) rather than only on the profile
 * page. Members without one keep falling through to Gravatar.
 */
class AvatarService
{
    /**
     * Image types accepted for a profile picture.
     *
     * Narrower than the attachment validator's allow-list, which also permits
     * documents: a PDF is a valid attachment but not a valid face.
     */
    public const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    /**
     * User meta key holding the attachment id of the custom picture.
     */
    private const META_KEY = Config::VAR_PREFIX . 'avatar_id';

    /**
     * Register the WordPress filters. Called once from the hook provider.
     */
    public static function registerHooks(): void
    {
        // pre_get_avatar_data covers get_avatar() and get_avatar_url() in one
        // place — filtering only get_avatar_url would leave any theme or plugin
        // calling get_avatar() still showing Gravatar.
        Hooks::addFilter('pre_get_avatar_data', [self::class, 'filterAvatarData'], 10, 2);
    }

    /**
     * Attachment id of a member's custom picture, or 0 when they have none.
     *
     * @param int $userId
     *
     * @return int
     */
    public static function avatarId($userId)
    {
        return (int) get_user_meta((int) $userId, self::META_KEY, true);
    }

    /**
     * URL of a member's custom picture, or null when they have none.
     *
     * @param int $userId
     * @param int $size    requested square size in pixels
     *
     * @return null|string
     */
    public static function avatarUrl($userId, $size = 96)
    {
        $attachmentId = self::avatarId($userId);
        $url = false;

        if ($attachmentId > 0) {
            // Serve a generated size rather than the original: an avatar
            // rendered at 24px should not download a 2000px upload.
            $imageSize = $size <= 150 ? 'thumbnail' : 'medium';
            $url = wp_get_attachment_image_url($attachmentId, $imageSize);

            if (!$url) {
                // Attachment was deleted outside the portal — drop the dangling
                // reference so the member falls back to Gravatar cleanly.
                delete_user_meta((int) $userId, self::META_KEY);
            }
        }

        // Single exit returning an expression: an early `return null;` gets
        // rewritten to a bare `return;` by cs-fixer, which then fails the
        // declared `?string` return type under PHPStan.
        return $url ?: null;
    }

    /**
     * Point WordPress at the custom picture when the member has one.
     *
     * @param array $args
     * @param mixed $idOrEmail user id, email, WP_User, WP_Post or WP_Comment
     *
     * @return array
     */
    public static function filterAvatarData($args, $idOrEmail)
    {
        $userId = self::resolveUserId($idOrEmail);

        if ($userId === 0) {
            return $args;
        }

        $url = self::avatarUrl($userId, (int) ($args['size'] ?? 96));

        if ($url === null) {
            return $args;
        }

        $args['url'] = $url;
        // Signals to WordPress that the URL is final; without it core can still
        // rebuild a Gravatar URL further down the filter chain.
        $args['found_avatar'] = true;

        return $args;
    }

    /**
     * Attach an uploaded image to a member, replacing any previous picture.
     *
     * @param int $userId
     * @param int $attachmentId
     */
    public static function setAvatar($userId, $attachmentId)
    {
        $userId = (int) $userId;
        $previous = self::avatarId($userId);

        update_user_meta($userId, self::META_KEY, (int) $attachmentId);

        // Replacing a picture would otherwise leave the old file orphaned in the
        // media library on every change.
        if ($previous > 0 && $previous !== (int) $attachmentId) {
            wp_delete_attachment($previous, true);
        }
    }

    /**
     * Drop a member's custom picture and the file behind it.
     *
     * @param int $userId
     *
     * @return bool whether there was one to remove
     */
    public static function removeAvatar($userId)
    {
        $userId = (int) $userId;
        $attachmentId = self::avatarId($userId);

        delete_user_meta($userId, self::META_KEY);

        if ($attachmentId > 0) {
            wp_delete_attachment($attachmentId, true);

            return true;
        }

        return false;
    }

    /**
     * Normalise WordPress's many avatar identifiers down to a user id.
     *
     * @param mixed $idOrEmail
     *
     * @return int 0 when it does not resolve to a registered user
     */
    private static function resolveUserId($idOrEmail)
    {
        if (is_numeric($idOrEmail)) {
            return (int) $idOrEmail;
        }

        if ($idOrEmail instanceof WP_User) {
            return (int) $idOrEmail->ID;
        }

        if ($idOrEmail instanceof WP_Post) {
            return (int) $idOrEmail->post_author;
        }

        if ($idOrEmail instanceof WP_Comment) {
            // Guest comments have user_id 0 and only ever get a Gravatar.
            return (int) $idOrEmail->user_id;
        }

        if (\is_string($idOrEmail) && is_email($idOrEmail)) {
            $user = get_user_by('email', $idOrEmail);

            return $user ? (int) $user->ID : 0;
        }

        return 0;
    }
}
