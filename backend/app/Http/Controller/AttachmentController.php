<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Http\Requests\AbortChunkedUploadRequest;
use BitApps\BitConnect\Http\Requests\DeleteAttachmentRequest;
use BitApps\BitConnect\Http\Requests\UploadAttachmentRequest;
use BitApps\BitConnect\Http\Requests\UploadChunkRequest;
use BitApps\BitConnect\Services\AttachmentValidatorService;
use BitApps\BitConnect\Services\AuthService;
use BitApps\BitConnect\Services\ChunkedUpload;
use BitApps\BitConnect\Services\UploadClaims;
use InvalidArgumentException;

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
        return $this->store($request->validatedFile(), false);
    }

    /**
     * One piece of a large upload; the attachment itself once the last
     * piece is in. See ChunkedUpload.
     */
    public function uploadChunk(UploadChunkRequest $request)
    {
        $userId = get_current_user_id();
        $uploadId = (string) $request->upload_id;

        try {
            $result = ChunkedUpload::receive(
                $userId,
                $uploadId,
                (int) $request->offset,
                (int) $request->size,
                (string) $request->name,
                $request->chunk()
            );
        } catch (InvalidArgumentException $e) {
            return Response::error($e->getMessage())->httpStatus(400);
        }

        if (!isset($result['file'])) {
            return Response::success(['received' => $result['received']]);
        }

        // The whole file is here: it now faces every check a single upload
        // does, and is thrown away if it fails one.
        try {
            $file = (new AttachmentValidatorService())->validate(
                $result['file'],
                null,
                AttachmentValidatorService::attachmentTypes(),
                true
            );
        } catch (InvalidArgumentException $e) {
            ChunkedUpload::discard($userId, $uploadId);

            return Response::error($e->getMessage())->httpStatus(400);
        }

        $response = $this->store($file, true);
        ChunkedUpload::discard($userId, $uploadId);

        return $response;
    }

    /** Throw away a large upload the member cancelled. */
    public function abortChunkedUpload(AbortChunkedUploadRequest $request)
    {
        ChunkedUpload::discard(get_current_user_id(), (string) $request->upload_id);

        return Response::success(['upload_id' => (string) $request->upload_id]);
    }

    /**
     * Hand a checked file to WordPress and record it as an attachment,
     * pending until a saved post uses it (UploadClaims).
     *
     * @param array $file      the validated file array
     * @param bool  $assembled put together by ChunkedUpload rather than uploaded by PHP
     */
    private function store(array $file, bool $assembled)
    {
        // wp_handle_upload() is an admin-side function, not loaded on REST requests.
        require_once ABSPATH . 'wp-admin/includes/file.php';

        // A file put together from pieces was never a PHP upload, so it is
        // moved in the way WordPress moves a file it fetched itself.
        $uploadedFile = $assembled
            ? wp_handle_sideload($file, ['test_form' => false])
            : wp_handle_upload($file, ['test_form' => false]);

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

        // wp_generate_attachment_metadata() is admin-side too.
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $attachData = wp_generate_attachment_metadata($attachId, $uploadedFile['file']);
        wp_update_attachment_metadata($attachId, $attachData);

        UploadClaims::recordUpload((int) $attachId);

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
