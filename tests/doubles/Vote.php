<?php

namespace BitApps\BitConnect\Model;

/**
 * Test double for the Vote model.
 *
 * One row per vote, in $GLOBALS['__bc_votes'], each carrying user_id and either
 * post_id or comment_id — the same shape the table holds.
 *
 * Loaded from bootstrap.php before the Composer autoloader, like the other
 * model doubles.
 */
class Vote
{
    /** @var array<string, mixed> */
    private $attributes = [];

    /**
     * @param array<string, mixed> $attributes
     */
    public function fill(array $attributes): self
    {
        $this->attributes = $attributes;

        return $this;
    }

    public function save(): bool
    {
        $GLOBALS['__bc_votes'][] = array_merge(
            ['comment_id' => null, 'post_id' => null],
            $this->attributes
        );

        return true;
    }

    public static function getPostVoteCount(int $postId): int
    {
        return \count(self::matching(static fn ($row) => (int) ($row['post_id'] ?? 0) === $postId));
    }

    public static function hasUserVoted(int $userId, int $postId): bool
    {
        return self::matching(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['post_id'] ?? 0) === $postId
        ) !== [];
    }

    public static function getUserVoteForPost(int $userId, int $postId)
    {
        $rows = self::matching(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['post_id'] ?? 0) === $postId
        );

        return $rows === [] ? null : (object) reset($rows);
    }

    public static function deleteUserVoteForPost(int $userId, int $postId): bool
    {
        return self::remove(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['post_id'] ?? 0) === $postId
        );
    }

    public static function deleteAllVotesForPost(int $postId): bool
    {
        return self::remove(static fn ($row) => (int) ($row['post_id'] ?? 0) === $postId);
    }

    public static function getCommentVoteCount(int $commentId): int
    {
        return \count(self::matching(static fn ($row) => (int) ($row['comment_id'] ?? 0) === $commentId));
    }

    public static function hasUserVotedComment(int $userId, int $commentId): bool
    {
        return self::matching(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['comment_id'] ?? 0) === $commentId
        ) !== [];
    }

    public static function getUserVoteForComment(int $userId, int $commentId)
    {
        $rows = self::matching(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['comment_id'] ?? 0) === $commentId
        );

        return $rows === [] ? null : (object) reset($rows);
    }

    public static function deleteUserVoteForComment(int $userId, int $commentId): bool
    {
        return self::remove(
            static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId
                && (int) ($row['comment_id'] ?? 0) === $commentId
        );
    }

    public static function deleteAllVotesForComment(int $commentId): bool
    {
        return self::remove(static fn ($row) => (int) ($row['comment_id'] ?? 0) === $commentId);
    }

    public static function deleteAllVotesByUser(int $userId): bool
    {
        return self::remove(static fn ($row) => (int) ($row['user_id'] ?? 0) === $userId);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private static function matching(callable $predicate): array
    {
        return array_values(array_filter($GLOBALS['__bc_votes'] ?? [], $predicate));
    }

    private static function remove(callable $predicate): bool
    {
        $before = \count($GLOBALS['__bc_votes'] ?? []);

        $GLOBALS['__bc_votes'] = array_values(
            array_filter(
                $GLOBALS['__bc_votes'] ?? [],
                static fn ($row) => !$predicate($row)
            )
        );

        return \count($GLOBALS['__bc_votes']) < $before;
    }
}
