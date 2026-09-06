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
final class UpdatePortalSlugRequest extends Request
{
    /**
     * Moving the portal invalidates the rewrite rules and changes every topic
     * URL on the site, so it sits behind the same capability as creating it.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to move the portal.';
        }

        return 'You do not have permission to move the portal.';
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

    public function sanitizedSlug(): string
    {
        return sanitize_title((string) $this->slug);
    }
}
