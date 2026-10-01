<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Enum\AdminSettings;
use BitApps\BitConnect\Enum\TopicFieldMode;

/**
 * Which of the topic form's optional fields are asked, and which must be filled.
 *
 * The admin screen sets a mode per field; the portal draws the form from it and
 * CreateTopicRequest enforces it, so a required field is required of anything
 * that creates a topic, not only of the portal's own form.
 */
final class TopicFormFields
{
    /**
     * Field key => the boolean an earlier build stored for it, which both drew
     * the field and required it: true reads as required, false as hidden.
     */
    private const LEGACY_KEYS = [
        'topicType' => 'requireTopicType',
    ];

    /**
     * What a forum that has never saved this screen asks for: a topic type,
     * required.
     *
     * @return array{topicType: string}
     */
    public static function defaults(): array
    {
        return [
            'topicType' => TopicFieldMode::REQUIRED->value,
        ];
    }

    /**
     * Each field's mode, read from a stored group in either shape.
     *
     * @param mixed $stored the `topicFormFields` group as saved, or anything else
     *
     * @return array{topicType: string}
     */
    public static function normalize($stored): array
    {
        $stored = \is_array($stored) ? $stored : [];
        $modes = self::defaults();

        foreach (self::LEGACY_KEYS as $field => $legacyKey) {
            $mode = TopicFieldMode::tryFrom(\is_string($stored[$field] ?? null) ? $stored[$field] : '');

            if ($mode !== null) {
                $modes[$field] = $mode->value;
            } elseif (\is_bool($stored[$legacyKey] ?? null)) {
                $modes[$field] = ($stored[$legacyKey] ? TopicFieldMode::REQUIRED : TopicFieldMode::HIDDEN)->value;
            }
        }

        return $modes;
    }

    /**
     * The saved modes.
     *
     * @return array{topicType: string}
     */
    public static function current(): array
    {
        $settings = Config::getOption(AdminSettings::OPTION_NAME->value, []);

        return self::normalize(\is_array($settings) ? ($settings['topicFormFields'] ?? []) : []);
    }

    /**
     * Whether a topic cannot be created without this field.
     *
     * @param string $field `topicType`
     */
    public static function isRequired(string $field): bool
    {
        return (self::current()[$field] ?? '') === TopicFieldMode::REQUIRED->value;
    }
}
