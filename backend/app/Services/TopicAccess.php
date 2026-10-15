<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\AdminSettings;

/**
 * The "What members can do" switches on Settings → Topics.
 *
 * The portal hides the Upvote button and the comment box when a switch is
 * off, but hiding is not refusing: the routes behind them stayed open to
 * anyone who called them directly. The controllers ask this before they act.
 *
 * Both are on until an administrator turns one off, matching
 * AdminSettingsController's defaults.
 */
final class TopicAccess
{
    public const COMMENT = 'comment';

    public const UPVOTE = 'upvote';

    public static function allows(string $action): bool
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);
        $access = \is_array($settings) && \is_array($settings['topicAccess'] ?? null) ? $settings['topicAccess'] : [];

        return !\array_key_exists($action, $access) || (bool) $access[$action];
    }
}
