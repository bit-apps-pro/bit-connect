<?php

namespace BitApps\BitConnect\Http\Requests;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationSettings;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Services\ProFeatures;

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
 * @property null|string $fromName
 * @property null|string $fromEmail
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
        return [
            'enabled'          => ['nullable', 'boolean'],
            'types'            => ['nullable', 'array'],
            'digestHour'       => ['nullable', 'integer'],
            'retentionDays'    => ['nullable', 'integer'],
            'fromName'         => ['nullable', 'string', 'max:120'],
            'fromEmail'        => ['nullable', 'string', 'max:190'],
            'defaultFrequency' => ['nullable', 'string'],
            'mailGreeting'     => ['nullable', 'string', 'max:200'],
            'mailIntro'        => ['nullable', 'string', 'max:200'],
            'mailDigestIntro'  => ['nullable', 'string', 'max:200'],
            'mailFooter'       => ['nullable', 'string', 'max:200'],
        ];
    }

    public function messages()
    {
        return [
            'fromEmail.max' => __('That address is too long.', 'bit-connect'),
            'fromName.max'  => __('Please keep the sender name under 120 characters.', 'bit-connect'),
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

        $fromEmail = \is_string($validated['fromEmail'] ?? null) ? trim($validated['fromEmail']) : '';

        // Sender identity, digest schedule and email wording come from the
        // Bit Connect Pro add-on. Without it the submitted values are dropped
        // and whatever is already stored is written back untouched.
        //
        // Carrying the stored value forward is the point, not politeness. The
        // screen posts the whole blob, and on a forum without the add-on it was
        // handed the *neutralised* values to display — so simply ignoring the
        // gate here would have every save quietly overwrite a lapsed
        // subscriber's sender and wording with the defaults they were shown.
        if (!ProFeatures::notificationCustomisation()) {
            return array_merge(
                [
                    'enabled'       => filter_var($validated['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
                    'types'         => $types,
                    'retentionDays' => NotificationSettings::retentionDays($validated),
                ],
                $this->storedProValues()
            );
        }

        return [
            'enabled' => filter_var($validated['enabled'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'types'   => $types,
            // Clamped on the way in as well as on the way out. The cron reads
            // these unsupervised, and an hour of 25 is a digest that never goes.
            'digestHour'    => NotificationSettings::digestHour($validated),
            'retentionDays' => NotificationSettings::retentionDays($validated),
            'fromName'      => \is_string($validated['fromName'] ?? null) ? trim($validated['fromName']) : '',
            // Stored empty rather than stored wrong: fromEmail() falls back to
            // the site's own address, which is a better answer than an
            // undeliverable one somebody mistyped.
            'fromEmail'        => $fromEmail !== '' && is_email($fromEmail) ? $fromEmail : '',
            'defaultFrequency' => NotificationSettings::isValidFrequency($frequency)
                ? $frequency
                : NotificationSettings::FREQUENCY_INSTANT,
            // Email wording. Stripped of tags rather than escaped: these are
            // plain-text emails, so markup would be printed literally at best,
            // and an admin field that ends up in every member's inbox is not
            // somewhere to accept HTML on trust. Blank is stored as blank and
            // reads back as the built-in wording.
            'mailGreeting'    => $this->line('mailGreeting'),
            'mailIntro'       => $this->line('mailIntro'),
            'mailDigestIntro' => $this->line('mailDigestIntro'),
            'mailFooter'      => $this->line('mailFooter'),
        ];
    }

    /**
     * The pro-only keys exactly as they sit in the option today.
     *
     * Read raw rather than through NotificationSettings, whose normalisers
     * already blank these for an unlicensed site — going through them would
     * return the neutralised values and defeat the whole purpose.
     *
     * @return array<string, mixed>
     */
    private function storedProValues(): array
    {
        $stored = Config::getOption(NotificationSettings::OPTION_NAME->value, []);
        $stored = \is_array($stored) ? $stored : [];

        $keys = [
            'fromName',
            'fromEmail',
            'defaultFrequency',
            'digestHour',
            'mailGreeting',
            'mailIntro',
            'mailDigestIntro',
            'mailFooter',
        ];

        $values = [];

        foreach ($keys as $key) {
            if (\array_key_exists($key, $stored)) {
                $values[$key] = $stored[$key];
            }
        }

        return $values;
    }

    /**
     * One template line, reduced to plain text.
     */
    private function line(string $key): string
    {
        $validated = $this->validated();
        $value = \is_string($validated[$key] ?? null) ? $validated[$key] : '';

        return trim(wp_strip_all_tags($value));
    }
}
