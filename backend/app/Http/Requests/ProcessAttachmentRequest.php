<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;

/**
 * Finish the work on an upload: see AttachmentProcessing.
 *
 * @property int $id
 */
final class ProcessAttachmentRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check('read');
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
