<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use WP_Comment;

/**
 * The decisions this plugin lets another plugin make.
 *
 * Every method here answers for itself, and that is the whole design. Each
 * one names a decision the plugin makes with a plain default — whether to
 * hide reported content before a human has looked at it, which asset bundle
 * the pages it renders should load, which capabilities this forum recognises,
 * what else is true of a comment, and what a member's upvote total comes to —
 * and hands it to a listener if there is one. With no listener the plugin's
 * own answer stands, and it is a complete, working behaviour.
 *
 * The filters are public. Any plugin may answer them, and nothing here knows
 * or asks which one does; a site that wanted its own moderation policy could
 * answer them itself.
 *
 * Callers ask this class rather than the filter directly, so the extension
 * points are enumerable in one file and a typo in a hook name is a missing
 * method rather than a behaviour that silently never turns on.
 *
 * Timing: none of these may be called before `plugins_loaded:12`, because a
 * listener registering at 11 has not been seen yet and the call would read as
 * "nobody answered".
 */
final class ExtensionPoints
{
    /**
     * The resolved bundle, which cannot change within a request.
     *
     * @var null|array{codeName: string, codeNameClient: string, uri: string}
     */
    private static ?array $assetBundle = null;

    /**
     * Where the admin and portal bundles are, and what their files are stamped
     * with.
     *
     * This plugin's own build, unless something answers with another. The
     * pages are still rendered here either way; only the files they load
     * change.
     *
     * The three travel together on purpose. Asked separately, a listener that
     * answers one and not another produces a URI from one build and a code
     * name from another, which names a file that does not exist; a listener
     * that cannot supply all three returns what it was given and the whole
     * working set falls back intact.
     *
     * Returning the array unchanged is a listener's normal way of declining,
     * so the shape is validated rather than trusted: anything missing a key or
     * answering with a non-string leaves this plugin's own bundle in place.
     *
     * Memoised because Head and BaseView each read all three while enqueuing,
     * and a filter that hits the filesystem should not run six times a page.
     * Called no earlier than `plugins_loaded:12`, like everything here — both
     * callers run on enqueue hooks, which is long after that.
     *
     * @return array{codeName: string, codeNameClient: string, uri: string}
     */
    public static function assetBundle(): array
    {
        if (self::$assetBundle !== null) {
            return self::$assetBundle;
        }

        $own = [
            'codeName'       => Config::readBuildCodeName(Config::ASSETS_FOLDER . '/build-code-name.txt'),
            'codeNameClient' => Config::readBuildCodeName(Config::ASSETS_FOLDER . '/client/build-code-name.txt'),
            'uri'            => Config::get('ROOT_URI') . '/' . Config::ASSETS_FOLDER,
        ];

        $offered = Hooks::applyFilter('bit_connect_asset_bundle', $own);

        foreach (array_keys($own) as $key) {
            if (!\is_array($offered) || !isset($offered[$key]) || !\is_string($offered[$key]) || $offered[$key] === '') {
                return self::$assetBundle = $own;
            }
        }

        return self::$assetBundle = [
            'codeName'       => $offered['codeName'],
            'codeNameClient' => $offered['codeNameClient'],
            'uri'            => $offered['uri'],
        ];
    }

    /**
     * Drops the memoised bundle.
     *
     * Only tests need it — they answer the filter differently per case and
     * would otherwise read the first case's answer for the whole run. Within a
     * request the bundle cannot change, so nothing in the plugin calls this.
     */
    public static function flush(): void
    {
        self::$assetBundle = null;
    }

    /**
     * The capability slugs this forum recognises.
     *
     * This plugin's own list, unless something adds to it. The role matrix is
     * built from this and, more importantly, applySettings() revokes anything
     * in it that a role was not granted — so a capability belonging to another
     * plugin has to be named here or saving the roles screen would strip it.
     *
     * A listener adds its own slugs and returns the list. Anything that is not
     * a non-empty string is dropped, and an answer that comes back empty or
     * malformed leaves this plugin's own list standing.
     *
     * @return list<string>
     */
    public static function capabilities(): array
    {
        $own = Capabilities::values();

        $offered = Hooks::applyFilter('bit_connect_capabilities', $own);

        if (!\is_array($offered)) {
            return $own;
        }

        $clean = array_values(
            array_unique(
                array_filter(
                    $offered,
                    static fn ($cap): bool => \is_string($cap) && $cap !== ''
                )
            )
        );

        return $clean === [] ? $own : $clean;
    }

    /**
     * The fields a formatted comment carries.
     *
     * Everything this plugin knows about a comment is in `$fields` already;
     * this is where a plugin that knows something more about the same comment
     * adds it. There is no key here for a listener to overwrite, and nothing
     * missing from a comment when nobody answers.
     *
     * Trusted no further than the shape: a listener that answers with
     * something that is not an array gets this plugin's own fields sent
     * instead of breaking the comment.
     *
     * @param array $fields    the comment as this plugin formats it
     * @param int   $commentId the comment being formatted
     */
    public static function commentFields(array $fields, int $commentId): array
    {
        $offered = Hooks::applyFilter('bit_connect_comment_fields', $fields, $commentId);

        return \is_array($offered) ? $offered : $fields;
    }

    /**
     * A thread ordered by something this plugin cannot order by.
     *
     * This plugin sorts a thread by date, either way round, and that is every
     * ordering it can perform: ordering by upvotes on replies needs upvotes on
     * replies, which it does not implement. Rather than silently treating an
     * ordering it does not know as "newest" — a sort control that does nothing
     * is the shape this plugin has been removing — it offers the question.
     *
     * A listener that recognises `$sort` returns the comments in that order. A
     * listener that does not returns null, and so does the absence of one, and
     * the caller falls back to its own date ordering.
     *
     * Trusted no further than the shape: an answer that is not a list of the
     * same comments is discarded rather than rendered, because a listener that
     * dropped or invented a reply would silently lose part of a thread.
     *
     * @param WP_Comment[] $comments the top-level comments, in date order
     * @param string       $sort     what was asked for
     *
     * @return null|array the ordered comments, or null to sort by date
     */
    public static function orderedComments(array $comments, string $sort): ?array
    {
        $offered = Hooks::applyFilter('bit_connect_ordered_comments', null, $comments, $sort);

        if (!\is_array($offered) || \count($offered) !== \count($comments)) {
            return null;
        }

        return $offered;
    }

    /**
     * The reply pinned to a topic, or 0 when none is.
     *
     * This plugin has no pin action anywhere — no route, no capability, no
     * menu entry. What it has is the reading half: a comment carries a
     * `pinned` flag and the thread puts a pinned reply first, both of which
     * are inert until something answers here with an id. Without a listener
     * that is never, so the flag is false on every comment and the ordering
     * is the ordering the reader asked for.
     *
     * Asked once per request and compared against each comment in turn, rather
     * than asked per comment: the listener reads post meta, and a filter call
     * for every reply on a three-hundred-reply topic would be three hundred
     * reads to answer one question.
     *
     * The listener is responsible for the id still being pinnable — a pinned
     * reply that has since been deleted, unapproved or hidden by a report must
     * come back as 0, or the portal would hoist a tombstone to the top of the
     * thread. This plugin cannot check that itself without knowing what the
     * listener stored, and does not try: whatever id comes back is matched
     * against comments already filtered for visibility, and a stale one
     * simply matches nothing.
     *
     * @param int $topicId the topic whose pin is being asked about
     */
    public static function pinnedCommentId(int $topicId): int
    {
        return (int) Hooks::applyFilter('bit_connect_pinned_comment', 0, $topicId);
    }

    /**
     * The events this forum can actually tell a member about.
     *
     * Every case this plugin raises by itself, which is all of them bar
     * BADGE_AWARDED — see NotificationTypes::isDispatchedHere() for why that
     * one is in the vocabulary but not in this plugin's dispatch. A plugin that
     * does raise it adds its slug back and the preference row returns with it.
     *
     * This governs which rows the admin defaults screen and the member's own
     * preference screen draw. It does not govern delivery: a notification of
     * any type, raised by anybody, is resolved and sent on its own merits, so a
     * type missing from this list is one nobody is being asked about rather
     * than one being withheld.
     *
     * Answered with slugs rather than cases, like capabilities(), so a listener
     * needs nothing of this plugin's but the string. Anything that is not a
     * slug this plugin knows is dropped — a listener cannot invent an event the
     * dispatcher has no vocabulary for — and an answer that comes back empty or
     * malformed leaves this plugin's own list standing.
     *
     * @return list<NotificationTypes>
     */
    public static function notifiableTypes(): array
    {
        $own = array_values(
            array_filter(
                NotificationTypes::cases(),
                static fn (NotificationTypes $type): bool => NotificationTypes::isDispatchedHere($type)
            )
        );

        $offered = Hooks::applyFilter(
            'bit_connect_notifiable_types',
            array_map(static fn (NotificationTypes $type): string => $type->value, $own)
        );

        if (!\is_array($offered)) {
            return $own;
        }

        $resolved = [];

        foreach ($offered as $slug) {
            $type = \is_string($slug) ? NotificationTypes::tryFrom($slug) : null;

            if ($type !== null && !\in_array($type, $resolved, true)) {
                $resolved[] = $type;
            }
        }

        return $resolved === [] ? $own : $resolved;
    }

    /**
     * How many upvotes a member has received.
     *
     * This plugin counts the votes on their topics, which is every vote it
     * knows how to cast. A plugin that counts something else a member can
     * receive adds it here. Nobody answering leaves the topic figure, which is
     * a true total of what this forum offers rather than a partial one.
     *
     * @param int $count  votes on this member's topics
     * @param int $userId the member
     */
    public static function votesReceived(int $count, int $userId): int
    {
        return (int) Hooks::applyFilter('bit_connect_votes_received', $count, $userId);
    }

    /**
     * Whether reported content is hidden automatically once enough members
     * have reported it.
     *
     * This plugin queues reports and shows them to moderators; it never acts on
     * them by itself, and answering no here is that policy rather than a
     * feature switched off. A listener decides otherwise if it wants to, and is
     * passed everything it needs: the target, its author (so staff can be
     * exempted — otherwise a member who disagrees with a moderator could bury
     * the answer by reporting it) and the pending count, which the caller has
     * usually already read.
     *
     * @param string   $targetType 'post' or 'comment'
     * @param int      $targetId   the reported post or comment
     * @param int      $author     who wrote it
     * @param null|int $pending    open reports against it, or null to let the listener count
     */
    public static function autoHideOnReports(string $targetType, int $targetId, int $author, ?int $pending = null): bool
    {
        return (bool) Hooks::applyFilter(
            'bit_connect_should_auto_hide',
            false,
            $targetType,
            $targetId,
            $author,
            $pending
        );
    }
}
