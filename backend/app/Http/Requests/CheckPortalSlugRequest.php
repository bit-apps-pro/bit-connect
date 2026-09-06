<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Request input properties.
 *
 * @property null|string $slug
 */
final class CheckPortalSlugRequest extends Request
{
    /**
     * Manager-only: this answers "what is at this address", which walks the
     * site's page table one guess at a time for anyone allowed to ask.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to check a portal slug.';
        }

        return 'You do not have permission to check a portal slug.';
    }

    public function rules()
    {
        return [
            'slug' => ['required', 'string', 'max:200'],
        ];
    }

    public function messages()
    {
        return [
            'slug.required' => __('Slug is required.', 'bit-connect'),
        ];
    }

    /**
     * The slug as WordPress would store it, or '' when nothing survives.
     */
    public function sanitizedSlug(): string
    {
        return sanitize_title((string) $this->slug);
    }
}
