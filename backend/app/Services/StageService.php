<?php

declare(strict_types=1);

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Taxonomies;
use WP_Term;

/**
 * The default stage — the one new topics land in and the portal opens on.
 *
 * Ordering lives in TermOrderService; this only covers what is specific to
 * stages.
 */
final class StageService
{
    /**
     * Term meta flagging the default stage.
     *
     * The default stage used to be found by its `questions` slug, which meant
     * renaming it recreated a duplicate, dropped its delete protection and left
     * new topics with no stage. It is identified by this flag instead, so the
     * slug is free to change.
     */
    public const DEFAULT_META_KEY = 'is_default';

    /**
     * Stage terms in the admin-defined order.
     *
     * @return WP_Term[]
     */
    public static function ordered(): array
    {
        return TermOrderService::ordered(Taxonomies::STAGES->value);
    }

    /**
     * The stage new topics land in, and the one the portal opens on.
     */
    public static function defaultStage(): ?WP_Term
    {
        return DefaultTermService::find(Taxonomies::STAGES->value, self::DEFAULT_META_KEY);
    }

    /**
     * Slug of the default stage, for the frontends' fallback filter.
     */
    public static function defaultStageSlug(): string
    {
        $stage = self::defaultStage();

        return $stage ? $stage->slug : '';
    }

    /**
     * Whether a term is the default stage.
     *
     * @param WP_Term $term
     */
    public static function isDefault($term): bool
    {
        return DefaultTermService::isDefault($term, Taxonomies::STAGES->value, self::DEFAULT_META_KEY);
    }

    /**
     * Flag a stage as the default one.
     */
    public static function markDefault(int $termId): void
    {
        update_term_meta($termId, self::DEFAULT_META_KEY, 1);
    }
}
