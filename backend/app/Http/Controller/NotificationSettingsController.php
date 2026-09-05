<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Http\Requests\GetNotificationSettingsRequest;
use BitApps\BitConnect\Http\Requests\SendTestNotificationEmailRequest;
use BitApps\BitConnect\Http\Requests\UpdateNotificationSettingsRequest;
use BitApps\BitConnect\Providers\CronProvider;
use BitApps\BitConnect\Services\NotificationMailer;
use BitApps\BitConnect\Services\NotificationPreferences;

/**
 * The forum-wide notification settings.
 *
 * Answers with the settings *and* with the type catalogue, so the admin screen
 * never carries its own copy of the enum — a build where the two disagree shows
 * switches for types that cannot fire, or hides ones that can.
 */
final class NotificationSettingsController
{
    public function get(GetNotificationSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        return Response::success($this->payload());
    }

    public function update(UpdateNotificationSettingsRequest $request)
    {
        $data = $request->toSettingsData();

        $added = Config::addOption(NotificationSettings::OPTION_NAME->value, $data);

        if (!$added) {
            Config::updateOption(NotificationSettings::OPTION_NAME->value, $data);
        }

        // Dispatch resolves every recipient through the cached option, so a
        // notification raised later in this same request would otherwise be
        // decided by the settings as they were before this save.
        NotificationPreferences::flushSettings();

        // Switching the forum back on has to put the jobs back: deactivation
        // clears them, and an admin who disabled notifications and re-enabled
        // them would otherwise have a forum that writes rows and never mails
        // them.
        CronProvider::schedule();

        return Response::success($this->payload());
    }

    /**
     * Sends the signed-in admin one message, using the settings as saved.
     *
     * The one control that turns "is mail working on this site?" from a support
     * thread into a click. Deliberately sent to the admin's own address rather
     * than an arbitrary one — this is a diagnostic, not a way to mail strangers
     * from someone else's forum.
     */
    public function sendTest(SendTestNotificationEmailRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $user = wp_get_current_user();

        if (!$user || !is_email($user->user_email)) {
            return Response::error([], 422)
                ->message(__('Your account has no email address to send to.', 'bit-connect'));
        }

        $sent = NotificationMailer::sendTest((int) $user->ID);

        if (!$sent) {
            return Response::error([], 500)->message(
                __(
                    'WordPress could not send the message. Check this site\'s email configuration or SMTP plugin.',
                    'bit-connect'
                )
            );
        }

        return Response::success(
            [
                'sentTo' => $user->user_email,
            ]
        );
    }

    /**
     * Settings plus everything the screen needs to render them.
     *
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        $stored = Config::getOption(NotificationSettings::OPTION_NAME->value, []);

        $catalog = [];

        foreach (NotificationTypes::cases() as $type) {
            $catalog[] = [
                'type' => $type->value,
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- labels are English literals defined in #[Label] attributes; translated here at the read site
                'label' => __($type->label(), 'bit-connect'),
                // phpcs:ignore WordPress.WP.I18n.NonSingularStringLiteralText -- see above
                'description' => __($type->description(), 'bit-connect'),
                // The screen greys the member-override column for these: a
                // moderator-only type is never on an ordinary member's screen
                // to be overridden in the first place.
                'moderatorOnly' => NotificationTypes::isModeratorOnly($type),
                // And locks the in-app column for these, because the forum
                // sends them whatever anybody says.
                'mandatoryInApp' => NotificationTypes::isMandatoryInApp($type),
            ];
        }

        return [
            'settings'    => NotificationSettings::normalize($stored),
            'catalog'     => $catalog,
            'frequencies' => NotificationSettings::frequencies(),
            // What an admin may write in the template fields, described by the
            // code rather than by prose on the screen that would drift from it.
            'placeholders' => NotificationSettings::mailPlaceholders(),
            // So the screen can say where mail will appear to come from without
            // reimplementing the fallback chain.
            'effectiveSender' => [
                'name'  => NotificationSettings::fromName($stored),
                'email' => NotificationSettings::fromEmail($stored),
            ],
        ];
    }
}
