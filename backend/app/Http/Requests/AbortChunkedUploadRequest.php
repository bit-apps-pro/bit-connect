<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Http\Rules\PatternRule;

/**
 * Throw away a large upload the member cancelled before it finished.
 *
 * @property string $upload_id
 */
final class AbortChunkedUploadRequest extends Request
{
    public function authorize()
    {
        return Capabilities::check('read');
    }

    public function rules()
    {
        return [
            'upload_id' => ['required', 'string', new PatternRule('/^[a-f0-9]{32}$/')],
        ];
    }
}
