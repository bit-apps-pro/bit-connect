<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Http\Requests\GetCapabilitySettingsRequest;
use BitApps\BitConnect\Http\Requests\UpdateCapabilitySettingsRequest;
use BitApps\BitConnect\Services\CapabilityService;

/**
 * REST API controller for managing forum capability assignments.
 *
 * GET  /capability-settings
 *   Returns all WP roles with their current forum capability assignments
 *   plus the full list of available capabilities with labels.
 *
 * POST /capability-settings/update
 *   Updates capabilities for a single role.
 *   Body: { "role": "subscriber", "capabilities": { "forum_create_post": true, ... } }
 */
final class CapabilitySettingsController
{
    public function get(GetCapabilitySettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        // __() can't run inside enum #[Label] attributes (constant expressions
        // only), so translate the English labels here at the read site.
        $capabilityLabels = array_map(
            // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
            static fn (string $label): string => __($label, 'bit-connect'),
            Capabilities::labels()
        );

        return Response::success(
            [
                'roles'            => CapabilityService::getRolesWithCapabilities(),
                'allCapabilities'  => Capabilities::values(),
                'capabilityLabels' => $capabilityLabels,
            ]
        );
    }

    public function update(UpdateCapabilitySettingsRequest $request)
    {
        $role = sanitize_key((string) $request->role);

        if (!get_role($role)) {
            return Response::error(__('Role not found.', 'bit-connect'))->httpStatus(404);
        }

        $caps = $request->sanitizedCapabilities();
        $updated = CapabilityService::updateRoleCapabilities($role, $caps);

        if (!$updated) {
            return Response::error(__('Failed to update capabilities.', 'bit-connect'))->httpStatus(500);
        }

        return Response::success(
            [
                'role'         => $role,
                'capabilities' => $caps,
            ]
        );
    }
}
