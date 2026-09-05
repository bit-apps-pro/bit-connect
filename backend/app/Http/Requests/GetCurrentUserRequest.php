<?php

namespace BitApps\BitConnect\Http\Requests;

if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;

final class GetCurrentUserRequest extends Request
{
    public function authorize()
    {
        // Public endpoint: reports the current identity, or null for a guest.
        // A logged-out visitor is a valid state, not an authorization failure.
        return true;
    }

    public function rules()
    {
        return [];
    }
}
