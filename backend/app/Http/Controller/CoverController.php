<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\DeleteCoverRequest;
use BitApps\BitConnect\Http\Requests\UploadCoverRequest;
use BitApps\BitConnect\Services\CoverImageService;

/**
 * Profile cover image upload and removal.
 *
 * POST /users/{id}/cover        — replace the member's cover
 * POST /users/{id}/cover/remove — fall back to the gradient
 *
 * Both are owner-only; see UploadCoverRequest::authorize().
 */
final class CoverController
{
    private const HTTP_BAD_REQUEST = 400;

    private const HTTP_SERVER_ERROR = 500;

    public function upload(UploadCoverRequest $request)
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
                // Same reason as the avatar's: a slug derived from the filename
                // lands the attachment on a URL the portal already publishes,
                // and WordPress then redirects that URL to the raw image.
                'post_name'    => 'bit-connect-cover-' . $userId,
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

        // Generates the sized images CoverImageService serves; without this the
        // card would download the full-size original on every view.
        wp_update_attachment_metadata(
            $attachmentId,
            wp_generate_attachment_metadata($attachmentId, $uploaded['file'])
        );

        CoverImageService::setCover($userId, $attachmentId);

        return Response::success(
            [
                'cover' => CoverImageService::coverUrl($userId),
                'id'    => $attachmentId,
            ]
        );
    }

    public function remove(DeleteCoverRequest $request)
    {
        $removed = CoverImageService::removeCover((int) $request->id);

        return Response::success(
            [
                // Null, so the card knows to draw the gradient again.
                'cover'   => null,
                'removed' => $removed,
            ]
        );
    }
}
