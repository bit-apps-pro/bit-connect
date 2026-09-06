<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\AttachmentValidatorService;
use BitApps\BitConnect\Services\CoverImageService;
use InvalidArgumentException;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class UploadCoverRequest extends Request
{
    /**
     * Server-verified file from validateFile(). Upload THIS, never the raw
     * $_FILES entry — the client controls the name and the declared MIME.
     *
     * @var null|array
     */
    private $validatedFile;

    /**
     * Owner only, for the same reason as the avatar: a cover is part of how the
     * member presents themselves, and nothing about moderation needs it
     * replaceable from the portal.
     */
    public function authorize()
    {
        $userId = (int) $this->id;

        return $userId > 0 && get_current_user_id() === $userId;
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change your cover image.';
        }

        return 'You can only change your own cover image.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    /**
     * Validate the uploaded image.
     *
     * @return null|string error message, or null when the file is acceptable
     */
    public function validateFile(): ?string
    {
        $files = $this->files();

        if (empty($files['file'])) {
            return 'No image was uploaded.';
        }

        try {
            // Validates the real bytes on disk: magic-byte MIME sniffing plus
            // double-extension and dangerous-extension checks.
            $validated = (new AttachmentValidatorService())->validate($files['file']);
        } catch (InvalidArgumentException $e) {
            return $e->getMessage();
        }

        // The shared validator also allows documents; narrow it here using the
        // MIME it verified from magic bytes rather than anything the client
        // declared.
        if (!\in_array($validated['type'] ?? '', CoverImageService::ALLOWED_MIMES, true)) {
            return 'Cover images must be a JPG, PNG, GIF or WebP image.';
        }

        $this->validatedFile = $validated;

        return null;
    }

    /**
     * The verified file, available after a successful validateFile().
     */
    public function validatedFile(): ?array
    {
        return $this->validatedFile;
    }

    public function messages()
    {
        return [
            'id.required' => 'User ID is required.',
            'id.integer'  => 'User ID must be a valid integer.',
        ];
    }
}
