<?php

namespace BitApps\BitConnect\Model;

/**
 * Test double for the Notification model.
 *
 * Loaded from bootstrap.php before the Composer autoloader, the same mechanism
 * the Follow and ActivityLog doubles use.
 *
 * It exists so the dispatch rules can be tested at all. Those rules decide who
 * hears about what, which is the part of this system where a mistake is both
 * easiest to make and hardest to notice — nobody reports the notification they
 * never got, and one sent to the wrong person looks like a bug in somebody
 * else's feed.
 *
 * Rows land in $GLOBALS['__bc_notifications'], newest last, each with an id.
 */
class Notification
{
    /**
     * @param array<string, mixed> $attributes
     *
     * @return false|self
     */
    public static function insert(array $attributes)
    {
        if (!empty($GLOBALS['__bc_notification_insert_fails'])) {
            return false;
        }

        $id = \count($GLOBALS['__bc_notifications'] ?? []) + 1;

        $GLOBALS['__bc_notifications'][] = array_merge(
            ['id' => $id, 'event_count' => 1, 'read_at' => null, 'updated_at' => null],
            $attributes
        );

        // What deliver() actually reads the new row's id from.
        $GLOBALS['wpdb']->insert_id = $id;

        return new self();
    }

    /**
     * The unread row a repeat of this event should fold into, if there is one.
     *
     * Mirrors the real query's filters: same member, same type, same target,
     * still unread, and not older than the collapse window.
     *
     * @return null|object
     */
    public static function openCollapseTarget(
        int $userId,
        string $type,
        string $targetType,
        int $targetId,
        string $since
    ) {
        foreach ($GLOBALS['__bc_notifications'] ?? [] as $row) {
            if (
                (int) ($row['user_id'] ?? 0) === $userId
                && ($row['type'] ?? '') === $type
                && ($row['target_type'] ?? '') === $targetType
                && (int) ($row['target_id'] ?? 0) === $targetId
                && ($row['read_at'] ?? null) === null
                && (string) ($row['created_at'] ?? $since) >= $since
            ) {
                return (object) $row;
            }
        }

        return null;
    }
}
