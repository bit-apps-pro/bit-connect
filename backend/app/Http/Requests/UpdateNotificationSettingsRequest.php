<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Http\Rules\InRule;

/**
 * Request input properties.
 *
 * Everything is optional and everything is normalised on the way in. The screen
 * sends the whole blob, but a stale tab may send a type this build no longer
 * has, or a digest hour of 99 — so nothing here is trusted, and toSettingsData()
 * below is the only thing that decides what gets stored.
 *
 * @property null|bool   $enabled
 * @property null|array  $types            type value => {inapp, email, userMayOverride}
 * @property null|int    $digestHour
 * @property null|int    $retentionDays
 * @property null|string $defaultFrequency
 */
final class UpdateNotificationSettingsRequest extends Request
{
    public function authorize()
    {
        return WpCapabilities::check(Capabilities::MANAGE->value);
    }

    public function failedAuthorizationMessage(): string
    {
        if (!is_user_logged_in()) {
            return 'You must be logged in to change notification settings.';
        }

        return 'You do not have permission to change notification settings.';
    }

    public function rules()
    {
        // No sender or wording fields: this endpoint does not accept them,
        // because this plugin does not store them. They belong to the add-on
        // and are posted to the add-on's own endpoint.
        return [
            'enabled'          => ['nullable', 'boolean'],
            'types'            => ['nullable', 'array'],
            'digestHour'       => ['nullable', 'integer', 'min:0', 'max:23'],
            'retentionDays'    => ['nullable', 'integer', 'min:7', 'max:3650'],
            'defaultFrequency' => [
                'nullable',
                'string',
                new InRule(NotificationSettings::frequencies()),
            ],
        ];
    }

    public function messages()
    {
        return [
            'digestHour.min'       => __('Pick an hour between 0 and 23.', 'bit-connect'),
            'digestHour.max'       => __('Pick an hour between 0 and 23.', 'bit-connect'),
            'defaultFrequency.in'  => __('That is not a digest frequency this forum offers.', 'bit-connect'),
        ];
    }

    /**
     * The stored shape, built only from values this build recognises.
     *
     * Written here rather than in the controller so the option can never hold a
     * type that no longer exists or an hour that is not on the clock — the
     * clamps live in NotificationSettings, and every read already goes through
     * them, but storing rubbish and normalising it forever afterwards is how an
     * option becomes impossible to reason about.
     *
     * @return array<string, mixed>
     */
    public function toSettingsData(): array
    {
        $validated = $this->validated();

        $submitted = \is_array($validated['types'] ?? null) ? $validated['types'] : [];
        $types = [];

        // Driven by cases(), not by the payload: a type the screen omitted keeps
        // its stored value, and one it invented is dropped.
        foreach (NotificationTypes::cases() as $type) {
            $row = \is_array($submitted[$type->value] ?? null) ? $submitted[$type->value] : null;

            if ($row === null) {
                continue;
            }

            $types[$type->value] = [
                'inapp'           => filter_var($row['inapp'] ?? true, FILTER_VALIDATE_BOOLEAN),
                'email'           => filter_var($row['email'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'userMayOverride' => filter_var($row['userMayOverride'] ?? true, FILTER_VALIDATE_BOOLEAN),
            ];
        }

        $frequency = \is_string($validated['defaultFrequency'] ?? null)
            ? $validated['defaultFrequency']
            : NotificationSettings::FREQUENCY_INSTANT;

        // Sender identity and email wording are not written here: this plugin
        // has no setting for either. Sending as something other than the site, and rewriting the lines
        // around the list, are the Bit Connect Pro add-on's features; it stores
        // them in its own option and supplies them through the
        // `bit_connect_mail_from_name`, `bit_connect_mail_from_email` and
        // `bit_connect_mail_template` filters. Nothing to carry forward, and
        // nothing this endpoint can overwrite.
        return [
            'enabled' => filter_var($validated['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'types'   => $types,
            // Clamped on the way in as well as on the way out. The cron reads
            // these unsupervised, and an hour of 25 is a digest that never goes.
            'digestHour'    => NotificationSettings::digestHour($validated),
            'retentionDays' => NotificationSettings::retentionDays($validated),
            'defaultFrequency' => NotificationSettings::isValidFrequency($frequency)
                ? $frequency
                : NotificationSettings::FREQUENCY_INSTANT,
        ];
    }
}
