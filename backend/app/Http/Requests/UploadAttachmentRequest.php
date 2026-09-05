<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Services\AttachmentValidatorService;
use InvalidArgumentException;

final class UploadAttachmentRequest extends Request
{
    public const ALLOWED_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    public const MAX_SIZE = 5 * 1024 * 1024; // 5MB

    /**
     * The server-verified file array (sanitized name + magic-byte MIME),
     * populated by validateFile(). Callers should upload THIS, not the raw
     * client-supplied $_FILES entry.
     *
     * @var null|array
     */
    private $validatedFile;

    public function authorize()
    {
        return Capabilities::check('read');
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to upload an attachment.';
        }

        return 'You do not have permission to upload an attachment.';
    }

    public function rules()
    {
        return [];
    }

    public function validateFile(): ?string
    {
        $files = $this->files();

        if (empty($files['file'])) {
            return 'No file uploaded';
        }

        try {
            // Validate the REAL bytes on disk (magic-byte MIME sniffing,
            // double-extension and dangerous-extension checks). The
            // client-supplied $file['type'] / $file['size'] are attacker
            // controlled and must never be trusted.
            $this->validatedFile = (new AttachmentValidatorService())->validate($files['file']);
        } catch (InvalidArgumentException $e) {
            return $e->getMessage();
        }

        return null;
    }

    /**
     * The verified file array to hand to wp_handle_upload(), available after a
     * successful validateFile(). Falls back to the raw request file if, for any
     * reason, validation was not run.
     */
    public function validatedFile(): ?array
    {
        if ($this->validatedFile !== null) {
            return $this->validatedFile;
        }

        $files = $this->files();

        return $files['file'] ?? null;
    }
}
