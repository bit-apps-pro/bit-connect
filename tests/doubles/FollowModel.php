<?php

namespace BitApps\BitConnect\Model;

/**
 * Test double for the Follow model.
 *
 * Loaded from bootstrap.php *before* the Composer autoloader, which is the
 * whole mechanism: PHP only consults an autoloader for a class that is not
 * already defined, so this wins. The same trade every WP function stub in the
 * bootstrap makes, and safe here only because nothing under test wants the real
 * query builder.
 *
 * It exists so the recipient rules can be tested at all. Those rules decide who
 * a notification reaches, which is the part of this system where a mistake is
 * both easiest to make and hardest to notice — nobody reports the notification
 * they never got, and a mute that quietly stopped working looks exactly like a
 * quiet week.
 *
 * Seed rows per test:
 *
 *     $GLOBALS['__bc_follows'] = [
 *         ['user_id' => 7, 'target_type' => 'topic', 'target_id' => 9, 'muted' => 1],
 *     ];
 */
class Follow
{
    public const TARGET_TOPIC = 'topic';

    public const TARGET_DEPARTMENT = 'department';

    public const TARGET_TAG = 'tag';

    public const TARGET_FORUM = 'forum';

    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_AUTO = 'auto';

    /**
     * Everyone following this target and still listening.
     *
     * @return array<int, int>
     */
    public static function followerIdsFor(string $targetType, int $targetId): array
    {
        $ids = [];

        foreach (self::rows() as $row) {
            if (
                ($row['target_type'] ?? '') === $targetType
                && (int) ($row['target_id'] ?? 0) === $targetId
                // The filter the real query applies in SQL, and the one the
                // entire mute feature rests on.
                && (int) ($row['muted'] ?? 0) === 0
            ) {
                $ids[] = (int) $row['user_id'];
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * One member's follow of one thing, muted or not.
     *
     * Muted rows are returned on purpose: the caller has to be able to tell
     * "never followed" from "followed and silenced", because those are
     * different answers.
     *
     * @return null|object
     */
    public static function findFor(int $userId, string $targetType, int $targetId)
    {
        foreach (self::rows() as $row) {
            if (
                (int) ($row['user_id'] ?? 0) === $userId
                && ($row['target_type'] ?? '') === $targetType
                && (int) ($row['target_id'] ?? 0) === $targetId
            ) {
                return (object) array_merge(
                    ['muted' => 0, 'source' => self::SOURCE_MANUAL],
                    $row
                );
            }
        }

        return null;
    }


    /**
     * Appends a row, answering the id the way the real model does.
     *
     * @param array<string, mixed> $attributes
     *
     * @return false|int
     */
    public static function insert(array $attributes)
    {
        if (!empty($GLOBALS['__bc_follow_insert_fails'])) {
            return false;
        }

        $GLOBALS['__bc_follows'][] = array_merge(
            ['muted' => 0, 'source' => self::SOURCE_MANUAL, 'created_at' => '2026-08-27 09:00:00'],
            $attributes
        );

        return \count($GLOBALS['__bc_follows']);
    }

    /**
     * One member's unmuted follows of one kind, paginated.
     *
     * @return array{data: array<int, object>, total: int, pages: int}
     */
    public static function activeFor(int $userId, string $targetType, int $page, int $perPage): array
    {
        $rows = [];

        foreach (self::rows() as $row) {
            if (
                (int) ($row['user_id'] ?? 0) === $userId
                && ($row['target_type'] ?? '') === $targetType
                && (int) ($row['muted'] ?? 0) === 0
            ) {
                $rows[] = (object) array_merge(['source' => self::SOURCE_MANUAL, 'created_at' => ''], $row);
            }
        }

        $total = \count($rows);

        return [
            'data'  => \array_slice($rows, ($page - 1) * $perPage, $perPage),
            'total' => $total,
            'pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function rows(): array
    {
        return \is_array($GLOBALS['__bc_follows'] ?? null) ? $GLOBALS['__bc_follows'] : [];
    }
}
