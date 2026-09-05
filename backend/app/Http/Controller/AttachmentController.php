<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Http\Requests\DeleteAttachmentRequest;
use BitApps\BitConnect\Http\Requests\UploadAttachmentRequest;
use BitApps\BitConnect\Services\AuthService;

final class AttachmentController
{
    public function upload(UploadAttachmentRequest $request)
    {
        $fileError = $request->validateFile();

        if ($fileError !== null) {
            return Response::error($fileError)->httpStatus(400);
        }

        // Use the server-verified file (sanitized name + magic-byte MIME) from
        // validateFile() above — never the raw client-supplied $_FILES entry.
        $file = $request->validatedFile();

        include_once ABSPATH . 'wp-admin/includes/file.php';

        include_once ABSPATH . 'wp-admin/includes/media.php';

        include_once ABSPATH . 'wp-admin/includes/image.php';

        $uploadedFile = wp_handle_upload($file, ['test_form' => false]);

        if (isset($uploadedFile['error'])) {
            return Response::error('Upload failed: ' . $uploadedFile['error'])->httpStatus(500);
        }

        $attachment = [
            'post_mime_type' => $uploadedFile['type'],
            'post_title'     => sanitize_file_name(pathinfo($uploadedFile['file'], PATHINFO_FILENAME)),
            'post_content'   => '',
            'post_status'    => 'inherit',
        ];

        $attachId = wp_insert_attachment($attachment, $uploadedFile['file']);

        if (is_wp_error($attachId)) {
            return Response::error('Failed to create attachment: ' . $attachId->get_error_message())->httpStatus(500);
        }

        $attachData = wp_generate_attachment_metadata($attachId, $uploadedFile['file']);
        wp_update_attachment_metadata($attachId, $attachData);

        return Response::success(
            [
                'id'       => $attachId,
                'url'      => $uploadedFile['url'],
                'type'     => $uploadedFile['type'],
                'filename' => basename($uploadedFile['file']),
                'filesize' => filesize($uploadedFile['file']),
            ]
        );
    }

    public function delete(DeleteAttachmentRequest $request)
    {
        $attachmentId = $request->id;

        $attachment = get_post($attachmentId);

        if (!$attachment || $attachment->post_type !== 'attachment') {
            return Response::error('Attachment not found')->httpStatus(404);
        }

        $currentUserId = get_current_user_id();
        if ((int) $attachment->post_author !== $currentUserId && !Capabilities::check(AuthService::CAP_MODERATE)) {
            return Response::error('You do not have permission to delete this attachment')->httpStatus(403);
        }

        $deleted = wp_delete_attachment($attachmentId, true);

        if (!$deleted) {
            return Response::error('Failed to delete attachment')->httpStatus(500);
        }

        return Response::success(['id' => $attachmentId]);
    }
}
