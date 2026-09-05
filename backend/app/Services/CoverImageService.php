<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;

/**
 * The banner strip across the top of a member's profile card.
 *
 * Deliberately a near-twin of AvatarService rather than a shared abstraction:
 * the two differ in the size they serve and in the fact that an avatar has to
 * hijack WordPress's Gravatar pipeline while a cover has no core equivalent to
 * fight. Folding them together would mean a base class whose only shared part is
 * "an attachment id in user meta".
 *
 * Members without one fall back to the gradient the profile card has always
 * drawn, so this is additive — nothing depends on a cover existing.
 */
class CoverImageService
{
    /**
     * Image types accepted for a cover.
     *
     * The same list AvatarService accepts; the attachment validator's own
     * allow-list is broader and includes documents.
     */
    public const ALLOWED_MIMES = AvatarService::ALLOWED_MIMES;

    /**
     * User meta key holding the attachment id of the cover image.
     */
    private const META_KEY = Config::VAR_PREFIX . 'cover_id';

    /**
     * Attachment id of a member's cover, or 0 when they have none.
     *
     * @param int $userId
     *
     * @return int
     */
    public static function coverId($userId)
    {
        return (int) get_user_meta((int) $userId, self::META_KEY, true);
    }

    /**
     * URL of a member's cover, or null when they have none.
     *
     * @param int $userId
     *
     * @return null|string
     */
    public static function coverUrl($userId)
    {
        $attachmentId = self::coverId($userId);
        $url = false;

        if ($attachmentId > 0) {
            // A cover spans the full width of the card, so `large` rather than
            // the avatar's thumbnail — but still not the original, which may be
            // several thousand pixels wide.
            $url = wp_get_attachment_image_url($attachmentId, 'large');

            if (!$url) {
                // Attachment deleted outside the portal — drop the dangling
                // reference so the card falls back to the gradient cleanly.
                delete_user_meta((int) $userId, self::META_KEY);
            }
        }

        // Single exit returning an expression: an early `return null;` gets
        // rewritten to a bare `return;` by cs-fixer, which then fails the
        // declared `?string` return type under PHPStan.
        return $url ?: null;
    }

    /**
     * Attach an uploaded image to a member, replacing any previous cover.
     *
     * @param int $userId
     * @param int $attachmentId
     */
    public static function setCover($userId, $attachmentId)
    {
        $userId = (int) $userId;
        $previous = self::coverId($userId);

        update_user_meta($userId, self::META_KEY, (int) $attachmentId);

        // Replacing a cover would otherwise leave the old file orphaned in the
        // media library on every change.
        if ($previous > 0 && $previous !== (int) $attachmentId) {
            wp_delete_attachment($previous, true);
        }
    }

    /**
     * Drop a member's cover and the file behind it.
     *
     * @param int $userId
     *
     * @return bool whether there was one to remove
     */
    public static function removeCover($userId)
    {
        $userId = (int) $userId;
        $attachmentId = self::coverId($userId);

        delete_user_meta($userId, self::META_KEY);

        if ($attachmentId > 0) {
            wp_delete_attachment($attachmentId, true);

            return true;
        }

        return false;
    }
}
