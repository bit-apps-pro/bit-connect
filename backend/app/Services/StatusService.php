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
 * The default status — the one new topics are created with.
 *
 * Mirrors StageService: the slug `need-approval` used to identify it, which
 * stopped being safe once status slugs became editable.
 */
final class StatusService
{
    /**
     * Term meta flagging the default status.
     */
    public const DEFAULT_META_KEY = 'is_default';

    /**
     * Status terms in the admin-defined order.
     *
     * @return WP_Term[]
     */
    public static function ordered(): array
    {
        return TermOrderService::ordered(Taxonomies::STATUSES->value);
    }

    /**
     * The status new topics are created with.
     */
    public static function defaultStatus(): ?WP_Term
    {
        return DefaultTermService::find(Taxonomies::STATUSES->value, self::DEFAULT_META_KEY);
    }

    /**
     * Slug of the default status, for the portal's "awaiting approval" check.
     */
    public static function defaultStatusSlug(): string
    {
        $status = self::defaultStatus();

        return $status ? $status->slug : '';
    }

    /**
     * Whether a term is the default status.
     *
     * @param WP_Term $term
     */
    public static function isDefault($term): bool
    {
        return DefaultTermService::isDefault($term, Taxonomies::STATUSES->value, self::DEFAULT_META_KEY);
    }
}
