<?php

namespace BitApps\BitConnect\Enum\Concerns;

if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Description;
use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Attributes\Message;
use ReflectionEnum;

/**
 * Reusable helpers for backed enums.
 *
 * Reads #[Label], #[Description], #[Message] off each case, falling back to a
 * humanized case name. Reflection results are cached so reads don't re-reflect
 * per call.
 *
 * @mixin \BackedEnum
 */
trait EnumHelper
{
    public function label(): string
    {
        return $this->attribute(Label::class) ?? $this->humanizedName();
    }

    public function description(): string
    {
        return $this->attribute(Description::class) ?? $this->humanizedName();
    }

    public function message(): string
    {
        return $this->attribute(Message::class) ?? $this->humanizedName();
    }

    /**
     * Map of case value => label for every case.
     *
     * @return array<int|string, string>
     */
    public static function labels(): array
    {
        $labels = [];
        foreach (self::cases() as $case) {
            $labels[$case->value] = $case->label();
        }

        return $labels;
    }

    /**
     * List of { value, label } option objects for every case.
     *
     * @return array<int, array{value: int|string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            static fn (self $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
            ],
            self::cases()
        );
    }

    public static function tryFromValue(int|string $value): ?self
    {
        return self::tryFrom($value);
    }

    /**
     * The backing value of every case.
     *
     * @return array<int, int|string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * The name of every case.
     *
     * @return array<int, string>
     */
    public static function names(): array
    {
        return array_column(self::cases(), 'name');
    }

    /**
     * Read a string attribute off the current case, or null when absent.
     *
     * Enums cannot declare properties (not even via traits), so the reflection
     * cache lives in a method-local static keyed by enum + case + attribute.
     *
     * @param class-string $attributeClass
     */
    private function attribute(string $attributeClass): ?string
    {
        // Cache keyed by "<EnumFQN>::<CASE>::<attr>". Empty string is the
        // cached "no attribute" sentinel.
        static $cache = [];

        $cacheKey = self::class . '::' . $this->name . '::' . $attributeClass;

        if (\array_key_exists($cacheKey, $cache)) {
            return $cache[$cacheKey] === '' ? null : $cache[$cacheKey];
        }

        $case = (new ReflectionEnum(self::class))->getCase($this->name);
        $attributes = $case->getAttributes($attributeClass);

        $value = $attributes === [] ? '' : $attributes[0]->newInstance()->value;

        $cache[$cacheKey] = $value;

        return $value === '' ? null : $value;
    }

    /**
     * Fallback label derived from the case name: "CREATE_POST" -> "Create Post".
     */
    private function humanizedName(): string
    {
        return ucwords(strtolower(str_replace('_', ' ', $this->name)));
    }
}
