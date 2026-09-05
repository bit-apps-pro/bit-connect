<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
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
final class CreatePortalPageRequest extends Request
{
    /**
     * This publishes a page and a wp_template post, so it needs the capability
     * that governs the forum's placement rather than merely a login.
     */
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to create the portal page.';
        }

        return 'You do not have permission to create the portal page.';
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
