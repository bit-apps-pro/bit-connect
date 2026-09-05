<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\PortalAccess;

/**
 * The stages, statuses, departments, topic types and tags the portal filters
 * and the topic form are built from.
 *
 * This existed with no Request at all, so it answered anyone — which on a
 * members-only forum published the whole taxonomy structure, including terms an
 * administrator may have named after unreleased work.
 */
final class GetTaxonomiesRequest extends Request
{
    public function authorize()
    {
        return PortalAccess::canView();
    }

    public function failedAuthorizationMessage(): string
    {
        return PortalAccess::deniedMessage();
    }

    public function rules()
    {
        return [];
    }
}
