<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use WP_Error;

/**
 * The work WordPress does on a file after it is stored: the smaller copies of
 * a picture, the preview of a PDF, the length of a video.
 *
 * It is kept out of the upload request. On a large photo it takes many seconds
 * — 14 for a 50-megapixel one on a fast machine — and on a slow host that is
 * more than PHP or a proxy allows one request. The upload then failed after the
 * file was stored, and every attempt to send it again stored one more copy.
 *
 * Now the upload stores the file and answers, and the browser asks for this
 * work in a request of its own. A picture's copies are made one by one and each
 * is saved as it is made (wp_update_image_subsizes()), so a request that runs
 * out of time is not wasted: the next one makes only the copies still missing,
 * as the WordPress media library does. The portal shows the stored file itself,
 * so a post never waits on this work.
 */
final class AttachmentProcessing
{
    /**
     * Do the work still missing for an attachment.
     *
     * @return true|WP_Error
     */
    public static function run(int $attachmentId)
    {
        // Admin-side functions, not loaded on REST requests. media.php holds
        // wp_read_video_metadata(), which a video or audio file needs.
        if (!\function_exists('wp_update_image_subsizes')) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        if (!\function_exists('wp_read_video_metadata')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
        }

        if (wp_attachment_is_image($attachmentId)) {
            $meta = wp_update_image_subsizes($attachmentId);

            return is_wp_error($meta) ? $meta : true;
        }

        // Anything else is done in one step, so once there is metadata there
        // is nothing left to do.
        if (!empty(wp_get_attachment_metadata($attachmentId))) {
            return true;
        }

        $file = get_attached_file($attachmentId);

        if (!\is_string($file) || $file === '' || !is_file($file)) {
            return new WP_Error('bit_connect_attachment_file_missing', 'The uploaded file is missing.');
        }

        wp_update_attachment_metadata($attachmentId, wp_generate_attachment_metadata($attachmentId, $file));

        return true;
    }
}
