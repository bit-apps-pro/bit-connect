<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Http\Rules\AtLeastRule;
use BitApps\BitConnect\Http\Rules\PatternRule;

/**
 * One piece of a large upload (see ChunkedUpload).
 *
 * @property string $upload_id the random id the browser chose for the whole upload
 * @property int    $offset    where in the file this piece starts, in bytes
 * @property int    $size      the whole file's size, in bytes
 * @property string $name      the file's name
 */
final class UploadChunkRequest extends Request
{
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
        return [
            'upload_id' => ['required', 'string', new PatternRule('/^[a-f0-9]{32}$/')],
            'offset'    => ['required', 'integer', new AtLeastRule(0)],
            'size'      => ['required', 'integer', new AtLeastRule(1)],
            'name'      => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * The piece itself, as PHP received it.
     *
     * @return array<string, mixed>
     */
    public function chunk(): array
    {
        $files = $this->files();

        return \is_array($files['chunk'] ?? null) ? $files['chunk'] : [];
    }
}
