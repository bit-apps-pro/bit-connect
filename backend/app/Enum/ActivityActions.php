<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Enum\Attributes\Label;
use BitApps\BitConnect\Enum\Concerns\EnumHelper;

/**
 * What an activity log row records.
 *
 * Only actions taken on content the actor did not write. A member editing their
 * own reply is not activity anyone needs a log of — the "(edited)" note on the
 * comment already says it, and logging every self-edit would bury the handful of
 * rows that matter under thousands that do not.
 *
 * There is deliberately no edit case. Editing another member's words was
 * withdrawn — PermissionService::canEditPost() and canEditComment() require
 * ownership with no moderator or administrator override — so the only person who
 * can still edit is the one person whose edit is never recorded. An enum case
 * for it would be a filter offering a search that can only ever come back empty,
 * and a menu entry implying a power nobody has. Bit_Connect_PurgeEditActivity
 * clears the rows earlier builds wrote.
 *
 * Labels live in #[Label] attributes, read through the EnumHelper trait. __()
 * cannot run inside attribute args, so the translated wording lives in
 * translatedLabel() below — read that for display, label() for the raw English.
 */
enum ActivityActions: string
{
    use EnumHelper;

    #[Label('Deleted a topic')]
    case DELETE_POST = 'delete_post';

    #[Label('Deleted a comment')]
    case DELETE_COMMENT = 'delete_comment';

    #[Label('Pinned a topic')]
    case PIN_POST = 'pin_post';

    #[Label('Unpinned a topic')]
    case UNPIN_POST = 'unpin_post';

    #[Label('Locked a topic')]
    case LOCK_POST = 'lock_post';

    #[Label('Unlocked a topic')]
    case UNLOCK_POST = 'unlock_post';

    #[Label('Hidden after a report')]
    case HIDE = 'hide';

    #[Label('Restored after review')]
    case RESTORE = 'restore';

    #[Label('Reports resolved')]
    case RESOLVE_REPORTS = 'resolve_reports';

    /**
     * The label, translated.
     *
     * A match over literals rather than __($action->label()): `wp i18n make-pot`
     * reads source, not runtime, so a __() whose argument is an expression puts
     * nothing in the catalog — and a lookup the catalog does not hold returns
     * the English string in every locale. Wrapping at the read site translated
     * none of these; this does.
     *
     * The #[Label] attributes above remain the English wording every non-display
     * reader gets. EnumLabelTranslationTest asserts the two agree case
     * by case, so a reworded attribute cannot silently leave this behind.
     *
     * Static and typed by parameter rather than `self`: the coding standard's
     * sniff does not treat an enum as class scope.
     */
    public static function translatedLabel(ActivityActions $action): string
    {
        return match ($action) {
            self::DELETE_POST     => __('Deleted a topic', 'bit-connect'),
            self::DELETE_COMMENT  => __('Deleted a comment', 'bit-connect'),
            self::PIN_POST        => __('Pinned a topic', 'bit-connect'),
            self::UNPIN_POST      => __('Unpinned a topic', 'bit-connect'),
            self::LOCK_POST       => __('Locked a topic', 'bit-connect'),
            self::UNLOCK_POST     => __('Unlocked a topic', 'bit-connect'),
            self::HIDE            => __('Hidden after a report', 'bit-connect'),
            self::RESTORE         => __('Restored after review', 'bit-connect'),
            self::RESOLVE_REPORTS => __('Reports resolved', 'bit-connect'),
        };
    }

    /**
     * Actions that destroy their target.
     *
     * These are the rows that justify the table: once one is written, the thing
     * it describes no longer exists anywhere else.
     *
     * @return array<int, self>
     */
    public static function destructive(): array
    {
        return [self::DELETE_POST, self::DELETE_COMMENT];
    }
}
