<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;

/**
 * Request input properties.
 *
 * @property int $id
 */
final class DeleteAttachmentRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check('read');
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to delete this attachment.';
        }

        return 'You do not have permission to delete this attachment.';
    }

    public function rules()
    {
        return [
            'id' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages()
    {
        return [
            'id.required' => 'Attachment ID is required.',
            'id.integer'  => 'Attachment ID must be a valid integer.',
        ];
    }
}
