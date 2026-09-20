<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\Capabilities;

/**
 * Behaviour this plugin declines to perform, offered to anything that will.
 *
 * Every method here answers for itself, and that is the whole design. These
 * are not features this plugin has and withholds: it does not implement them
 * at all. Each one names a decision the plugin deliberately declines to make
 * by itself — whether to hide reported content before a human has looked at
 * it, which asset bundle the pages it renders should load, which capabilities
 * this forum recognises, what else is true of a comment, and what a member's
 * upvote total comes to — and hands it to a listener if there is one. With no
 * listener the plugin's own answer stands, and it is a complete, working
 * behaviour rather than a refusal.
 *
 * The filters are public. Any plugin may answer them; the Bit Connect Pro
 * add-on is the one that does, but nothing here knows or asks about that, and
 * a site that wanted its own moderation policy could answer them itself.
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
     * This plugin's own build, unless something answers with a fuller one. The
     * add-on is that something: it ships no view layer, so the pages are still
     * rendered here and only the files they load change. Nothing about a
     * licence is asked — the add-on answers whenever its build is on disk,
     * because a plugin whose interface is in another plugin's bundle needs
     * that bundle to reach its own settings screen at all.
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
     * adds it. The add-on uses it to attach the reply's upvote count and
     * whether the reader has cast one — a feature this plugin does not have,
     * so there is no key here to overwrite and nothing withheld when nobody
     * answers.
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
     * How many upvotes a member has received.
     *
     * This plugin counts the votes on their topics, which is every vote it
     * knows how to cast. The add-on adds the ones on their replies. Nobody
     * answering leaves the topic figure, which is a true total of what this
     * forum offers rather than a partial one.
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
