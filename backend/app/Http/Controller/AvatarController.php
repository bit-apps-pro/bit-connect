<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\DeleteAvatarRequest;
use BitApps\BitConnect\Http\Requests\UploadAvatarRequest;
use BitApps\BitConnect\Services\AvatarService;

/**
 * Profile picture upload and removal.
 *
 * POST /users/{id}/avatar        — replace the member's picture
 * POST /users/{id}/avatar/remove — fall back to Gravatar
 *
 * Both are owner-only; see UploadAvatarRequest::authorize().
 */
final class AvatarController
{
    private const HTTP_BAD_REQUEST = 400;

    private const HTTP_SERVER_ERROR = 500;

    public function upload(UploadAvatarRequest $request)
    {
        $fileError = $request->validateFile();

        if ($fileError !== null) {
            return Response::error($fileError)->httpStatus(self::HTTP_BAD_REQUEST);
        }

        include_once ABSPATH . 'wp-admin/includes/file.php';

        include_once ABSPATH . 'wp-admin/includes/media.php';

        include_once ABSPATH . 'wp-admin/includes/image.php';

        // The server-verified file, never the raw $_FILES entry. Assigned to a
        // variable first because wp_handle_upload() takes it by reference and
        // will not accept a method call.
        $file = $request->validatedFile();
        $uploaded = wp_handle_upload($file, ['test_form' => false]);

        if (isset($uploaded['error'])) {
            return Response::error('Upload failed: ' . $uploaded['error'])->httpStatus(self::HTTP_SERVER_ERROR);
        }

        $userId = (int) $request->id;

        $attachmentId = wp_insert_attachment(
            [
                'post_mime_type' => $uploaded['type'],
                'post_title'     => sanitize_file_name(pathinfo($uploaded['file'], \PATHINFO_FILENAME)),
                // Named rather than left to derive from the title: a picture
                // uploaded as `Aiden-Carter.webp` would otherwise take the slug
                // `aiden-carter`, which is a URL the portal already publishes —
                // the member's own profile, and any topic that happens to match.
                // WordPress resolves the attachment there and redirects the
                // visitor to the raw image.
                'post_name'    => 'bit-connect-avatar-' . $userId,
                'post_content' => '',
                'post_status'  => 'inherit',
                'post_author'  => $userId,
            ],
            $uploaded['file']
        );

        if (is_wp_error($attachmentId)) {
            return Response::error('Failed to store image: ' . $attachmentId->get_error_message())
                ->httpStatus(self::HTTP_SERVER_ERROR);
        }

        // Generates the sized images AvatarService serves; without this every
        // avatar would fall back to the full-size original.
        wp_update_attachment_metadata(
            $attachmentId,
            wp_generate_attachment_metadata($attachmentId, $uploaded['file'])
        );

        AvatarService::setAvatar($userId, $attachmentId);

        return Response::success(
            [
                'avatar' => AvatarService::avatarUrl($userId, 200),
                'id'     => $attachmentId,
            ]
        );
    }

    public function remove(DeleteAvatarRequest $request)
    {
        $userId = (int) $request->id;
        $removed = AvatarService::removeAvatar($userId);

        return Response::success(
            [
                // Whatever the member falls back to — normally their Gravatar.
                'avatar'  => get_avatar_url($userId),
                'removed' => $removed,
            ]
        );
    }
}
