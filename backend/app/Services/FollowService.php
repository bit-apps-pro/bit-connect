<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPDatabase\Connection;
use BitApps\BitConnect\Model\Follow;

/**
 * Who has asked to hear about what.
 *
 * The distinction this class exists to hold: **following and listening are not
 * the same state**. A member who replies to a thread is followed to it
 * automatically; a member who then mutes it is still followed and no longer
 * listening. Deleting the row on unfollow would work until their next reply
 * resubscribed them, and from their side the forum would look like it had
 * ignored a decision they had already made once. So mute is a column, and it is
 * the only thing recipient queries read.
 *
 * The two write paths are deliberately asymmetric:
 *
 *   - follow() is a member pressing the button. It creates the row *and*
 *     unmutes, because pressing Follow on something you muted plainly means you
 *     want it back.
 *   - autoFollow() is the forum acting on their behalf. It creates a row and
 *     never touches `muted`, because nothing a member does incidentally should
 *     undo something they chose deliberately.
 */
final class FollowService
{
    /**
     * Subscribe a member at their own request.
     *
     * Idempotent, and unmutes: the button's job is to leave the member
     * following and listening, whatever state they were in.
     */
    public static function follow(int $userId, string $targetType, int $targetId): bool
    {
        if (!self::isValidTarget($userId, $targetType, $targetId)) {
            return false;
        }

        $existing = Follow::findFor($userId, $targetType, $targetId);

        if ($existing !== null) {
            return self::setMuted($userId, $targetType, $targetId, false);
        }

        return self::insert($userId, $targetType, $targetId, Follow::SOURCE_MANUAL);
    }

    /**
     * Subscribe a member because they took part.
     *
     * Silent about failure on purpose — this runs alongside a comment or topic
     * that has already been written, and a follow that could not be recorded is
     * not a reason to tell the member their reply failed.
     *
     * Never unmutes. A member who muted a thread and then replied to it once
     * more has said both things, and the mute is the more recent deliberate one.
     */
    public static function autoFollow(int $userId, string $targetType, int $targetId): void
    {
        if (!self::isValidTarget($userId, $targetType, $targetId)) {
            return;
        }

        if (Follow::findFor($userId, $targetType, $targetId) !== null) {
            return;
        }

        self::insert($userId, $targetType, $targetId, Follow::SOURCE_AUTO);
    }

    /**
     * Stop notifying this member about this thing.
     *
     * Mutes rather than deletes. See the class note.
     */
    public static function unfollow(int $userId, string $targetType, int $targetId): bool
    {
        if (Follow::findFor($userId, $targetType, $targetId) === null) {
            // Nothing to mute yet, but the member has still expressed a wish,
            // and auto-follow would honour it tomorrow if we recorded nothing.
            // A muted row created now is what makes "I never want to hear about
            // this thread" survive their next reply to it.
            return self::insert($userId, $targetType, $targetId, Follow::SOURCE_MANUAL, true);
        }

        return self::setMuted($userId, $targetType, $targetId, true);
    }

    /**
     * Everyone following this target and still listening.
     *
     * The one read the dispatcher makes per event.
     *
     * @return array<int, int>
     */
    public static function followerIdsFor(string $targetType, int $targetId): array
    {
        if (!self::isValidTargetType($targetType) || !self::isValidTargetId($targetType, $targetId)) {
            return [];
        }

        return Follow::followerIdsFor($targetType, $targetId);
    }

    /**
     * Whether this member has explicitly silenced this thing.
     *
     * Distinct from "is not following": never having followed something is not
     * a decision, and muting it is. Recipient rules that include somebody for a
     * reason other than a follow row — a topic's own author, most of all — have
     * to ask this, or the mute button does nothing on the threads a member is
     * most likely to press it on.
     */
    public static function hasMuted(int $userId, string $targetType, int $targetId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $row = Follow::findFor($userId, $targetType, $targetId);

        return $row !== null && (int) $row->muted === 1;
    }

    /**
     * What the Follow button should say for this member and this thing.
     *
     * @return array{following: bool, muted: bool, source: string}
     */
    public static function stateFor(int $userId, string $targetType, int $targetId): array
    {
        $row = $userId > 0 ? Follow::findFor($userId, $targetType, $targetId) : null;

        if ($row === null) {
            return ['following' => false, 'muted' => false, 'source' => ''];
        }

        $muted = (int) $row->muted === 1;

        return [
            // Muted is not following, as far as the button is concerned. The row
            // survives so auto-follow cannot quietly undo the mute, but a member
            // who muted a thread should be offered "Follow", not "Unfollow".
            'following' => !$muted,
            'muted'     => $muted,
            'source'    => (string) $row->source,
        ];
    }

    /**
     * One member's follow list, for their own settings screen.
     *
     * @return array{data: array<int, array<string, mixed>>, pagination: array<string, int>}
     */
    public static function mine(int $userId, string $targetType, int $page = 1, int $perPage = 20): array
    {
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));

        $result = Follow::activeFor($userId, $targetType, $page, $perPage);

        return [
            'data' => array_map(
                static fn ($row): array => [
                    'target_type' => (string) $row->target_type,
                    'target_id'   => (int) $row->target_id,
                    'source'      => (string) $row->source,
                    'created_at'  => (string) $row->created_at,
                ],
                $result['data']
            ),
            'pagination' => [
                'total'        => (int) ($result['total'] ?? 0),
                'per_page'     => $perPage,
                'current_page' => $page,
                'total_pages'  => (int) ($result['pages'] ?? 0),
            ],
        ];
    }

    /**
     * Everything a member follows, dropped when their account goes.
     *
     * Notifications go with the user too, but WordPress cannot do it for us here
     * the way it does for user meta — these are plugin tables.
     */
    public static function purgeUser(int $userId): void
    {
        Connection::delete(Config::withDBPrefix('follows'), ['user_id' => $userId], ['%d']);
    }

    public static function isValidTargetType(string $targetType): bool
    {
        return \in_array(
            $targetType,
            [Follow::TARGET_TOPIC, Follow::TARGET_DEPARTMENT, Follow::TARGET_TAG, Follow::TARGET_FORUM],
            true
        );
    }

    /**
     * Flips `muted` on an existing row.
     *
     * Written through $wpdb rather than the model layer, which cannot run it:
     * QueryBuilder::update() builds a statement and returns $this without
     * executing (exec() is private), and save() on a fetched row emits a
     * mismatched column list. Both fail quietly enough that the button would
     * appear to work and change nothing — the same trap ReportService hit.
     */
    private static function setMuted(int $userId, string $targetType, int $targetId, bool $muted): bool
    {
        $updated = Connection::update(
            Config::withDBPrefix('follows'),
            [
                'muted'      => $muted ? 1 : 0,
                'updated_at' => current_time('mysql', true),
            ],
            [
                'user_id'     => $userId,
                'target_type' => $targetType,
                'target_id'   => $targetId,
            ],
            ['%d', '%s'],
            ['%d', '%s', '%d']
        );

        // Zero rows means the value was already what was asked for, which is a
        // success from the caller's point of view. Only false is a failure.
        return $updated !== false;
    }

    private static function insert(
        int $userId,
        string $targetType,
        int $targetId,
        string $source,
        bool $muted = false
    ): bool {
        $stored = Follow::insert(
            [
                'user_id'     => $userId,
                'target_type' => $targetType,
                'target_id'   => $targetId,
                'source'      => $source,
                'muted'       => $muted ? 1 : 0,
            ]
        );

        // insert() answers false rather than throwing, and the unique index
        // means a second click on a slow connection lands here legitimately.
        return $stored !== false;
    }

    private static function isValidTarget(int $userId, string $targetType, int $targetId): bool
    {
        return $userId > 0
            && self::isValidTargetType($targetType)
            && self::isValidTargetId($targetType, $targetId);
    }

    /**
     * Whether this id makes sense for this kind of target.
     *
     * Forum-wide is the exception, and it is the reason this is a method rather
     * than a `> 0` check at each call site: "the whole forum" has no id, so it
     * is stored as 0. Every other target is a real row and must have one, or a
     * bug that loses an id quietly subscribes somebody to target zero.
     */
    private static function isValidTargetId(string $targetType, int $targetId): bool
    {
        if ($targetType === Follow::TARGET_FORUM) {
            return $targetId === 0;
        }

        return $targetId > 0;
    }
}
