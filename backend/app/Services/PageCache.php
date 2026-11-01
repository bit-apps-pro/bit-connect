<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\AuthSettings;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Views\BaseView;
use WP_Comment;
use WP_Post;
use WP_Term;

/**
 * Keeps the site's page cache in step with the portal.
 *
 * A page cache keeps the portal's HTML, and that HTML carries more than a
 * theme page: the topic lists, the answers PortalPreload put in it, the
 * settings, and the name of the bundle that draws it. A cache plugin purges a
 * post's permalink when the post changes, but a topic is read at its portal
 * URL, not at its permalink, and a vote, a setting or a new build changes no
 * post at all. So nothing was purged, and a guest saw the old page until the
 * cache expired — or, after an update, a page whose bundle no longer existed.
 *
 * This purges what changed, in the forms the common caches hear:
 *
 * - LiteSpeed Cache: every portal page carries the tag `bit_connect`, and one
 *   tag purge empties them all, the archives and the paginated lists included.
 * - Caches that purge by URL (WP Rocket, W3 Total Cache, WP Super Cache, Cache
 *   Enabler, SiteGround, Nginx Helper): the topic's portal URL, the portal's
 *   home and the archives the topic is filed under.
 * - A change every portal page shows — a setting, a term, a new build — asks
 *   those caches to empty everything, because they cannot purge "every portal
 *   page" and a stale page there can show what is no longer public.
 *
 * `bit_connect_purge_page_cache` fires with the URLs (or null for everything),
 * for a host's own cache that none of the above reaches.
 *
 * Requests are collected and sent once, on `shutdown`: a save fires several of
 * the hooks below, and LiteSpeed reads its purge list as the response ends.
 */
final class PageCache
{
    /** The LiteSpeed Cache tag on every page that draws the portal. */
    public const TAG = 'bit_connect';

    /** The bundle the cached pages were drawn with — see purgeOnNewBuild(). */
    private const BUILD_OPTION = 'page_cache_build';

    /** @var array<string, true> */
    private static array $urls = [];

    private static bool $everything = false;

    private static bool $flushScheduled = false;

    public static function registerHooks(): void
    {
        Hooks::addAction('transition_post_status', [self::class, 'handlePostStatusChanged'], 10, 3);
        // A forced delete skips the trash and so never transitions.
        Hooks::addAction('before_delete_post', [self::class, 'handlePostDeleted'], 10, 2);

        // An approved insert never transitions, so both hooks are needed.
        Hooks::addAction('wp_insert_comment', [self::class, 'handleCommentChanged'], 10, 2);
        Hooks::addAction('edit_comment', [self::class, 'handleCommentChanged'], 10, 2);
        Hooks::addAction('transition_comment_status', [self::class, 'handleCommentStatusChanged'], 10, 3);
        Hooks::addAction('deleted_comment', [self::class, 'handleCommentChanged'], 10, 2);

        // Every portal page carries the terms (PortalPreload) and lists them.
        Hooks::addAction('created_term', [self::class, 'handleTermChanged'], 10, 3);
        Hooks::addAction('edited_term', [self::class, 'handleTermChanged'], 10, 3);
        Hooks::addAction('delete_term', [self::class, 'handleTermChanged'], 10, 3);

        Hooks::addAction('added_option', [self::class, 'handleOptionChanged']);
        Hooks::addAction('updated_option', [self::class, 'handleOptionChanged']);

        // After init:11, where the add-on's filter on the bundle is in place.
        Hooks::addAction('wp_loaded', [self::class, 'purgeOnNewBuild']);

        // Resolves the portal on template_redirect; see BaseView::rendersPortal().
        Hooks::addAction('template_redirect', [self::class, 'markPortalResponse'], 99);
    }

    /**
     * A topic's own page and the lists it is in.
     */
    public static function topic(int $topicId): void
    {
        $topic = get_post($topicId);

        if (!$topic instanceof WP_Post || $topic->post_type !== PostTypes::BIT_CONNECT->value) {
            return;
        }

        $urls = [PortalLocation::url()];

        // The slugs the topic was read at: its own, without the `__trashed`
        // that core adds as it trashes it, and the ones it had before a rename.
        $slugs = (array) get_post_meta($topicId, '_wp_old_slug');
        $slugs[] = preg_replace('/__trashed$/', '', $topic->post_name);

        foreach ($slugs as $slug) {
            if (\is_string($slug) && $slug !== '') {
                $urls[] = PortalLocation::url($slug);
            }
        }

        // get_the_terms() reads the term cache the save just filled.
        foreach (PortalTaxonomies::map() as $taxonomy) {
            $terms = get_the_terms($topic, $taxonomy);

            foreach (\is_array($terms) ? $terms : [] as $term) {
                if ($term instanceof WP_Term) {
                    $urls[] = PortalTaxonomies::urlForTerm($term);
                }
            }
        }

        self::urls($urls);
    }

    /**
     * Every page that draws the portal.
     */
    public static function portal(): void
    {
        self::$everything = true;
        self::scheduleFlush();
    }

    /**
     * @param string[] $urls
     */
    public static function urls(array $urls): void
    {
        foreach ($urls as $url) {
            if (\is_string($url) && $url !== '') {
                self::$urls[user_trailingslashit($url)] = true;
            }
        }

        self::scheduleFlush();
    }

    /**
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $post
     */
    public static function handlePostStatusChanged($newStatus, $oldStatus, $post): void
    {
        // An edit is publish → publish. A topic that was never public, and is
        // not now, was in no cached page.
        if (!$post instanceof WP_Post || ($newStatus !== 'publish' && $oldStatus !== 'publish')) {
            return;
        }

        self::topic((int) $post->ID);
    }

    /**
     * @param int|string $postId
     * @param mixed      $post
     */
    public static function handlePostDeleted($postId, $post = null): void
    {
        $post = $post instanceof WP_Post ? $post : get_post((int) $postId);

        if ($post instanceof WP_Post && $post->post_status === 'publish') {
            self::topic((int) $post->ID);
        }
    }

    /**
     * @param int|string $commentId
     * @param mixed      $comment
     */
    public static function handleCommentChanged($commentId, $comment = null): void
    {
        $comment = $comment instanceof WP_Comment ? $comment : get_comment((int) $commentId);

        if ($comment instanceof WP_Comment) {
            self::topic((int) $comment->comment_post_ID);
        }
    }

    /**
     * @param string $newStatus
     * @param string $oldStatus
     * @param mixed  $comment
     */
    public static function handleCommentStatusChanged($newStatus, $oldStatus, $comment): void
    {
        if ($newStatus !== $oldStatus && $comment instanceof WP_Comment) {
            self::topic((int) $comment->comment_post_ID);
        }
    }

    /**
     * @param int|string $termId
     * @param int|string $termTaxonomyId
     * @param string     $taxonomy
     */
    public static function handleTermChanged($termId, $termTaxonomyId, $taxonomy): void
    {
        if (\in_array($taxonomy, self::portalTaxonomies(), true)) {
            self::portal();
        }
    }

    /**
     * @param string $option
     */
    public static function handleOptionChanged($option): void
    {
        if (\in_array($option, self::portalOptions(), true)) {
            self::portal();
        }
    }

    /**
     * Purges every portal page once the bundle they name has changed.
     *
     * The bundle's file names change with each build and the old files go with
     * the update, so a page cached before it asks for a script that is gone:
     * the visitor saw the loading dots and then the plain crawler view. This
     * reads the bundle on each request — one autoloaded option — and so also
     * catches an update by FTP, and the add-on turned on or off, which swaps
     * the bundle without an update at all.
     */
    public static function purgeOnNewBuild(): void
    {
        $build = Config::get('BUILD_CODE_NAME') . '|' . Config::get('BUILD_CODE_NAME_CLIENT');

        if (Config::getOption(self::BUILD_OPTION) === $build) {
            return;
        }

        Config::updateOption(self::BUILD_OPTION, $build, true);
        self::portal();
    }

    // phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- The cache plugins' own public API: their purge actions and the shared DONOTCACHEPAGE signal. This plugin declares none of them.

    /**
     * Tags a portal page for LiteSpeed, and keeps a member's copy out of every
     * cache.
     *
     * A member's page carries their account — the email address, what they may
     * do — and a nonce that expires within a day. WordPress already sends a
     * member no-cache headers, but a cache plugin set to keep pages for
     * signed-in users (LiteSpeed's private cache, WP Rocket's user cache) does
     * not read them. `DONOTCACHEPAGE` is the signal those plugins check.
     */
    public static function markPortalResponse(): void
    {
        if (!BaseView::rendersPortal()) {
            return;
        }

        do_action('litespeed_tag_add', self::TAG);

        if (!is_user_logged_in()) {
            return;
        }

        if (!defined('DONOTCACHEPAGE')) {
            \define('DONOTCACHEPAGE', true);
        }

        do_action('litespeed_control_set_nocache', 'bit-connect: a member\'s portal page');
    }

    public static function flush(): void
    {
        $urls = array_keys(self::$urls);
        $everything = self::$everything;

        self::$urls = [];
        self::$everything = false;
        self::$flushScheduled = false;

        if ($everything) {
            self::purgeEverything();
        } elseif ($urls !== []) {
            self::purgeUrls($urls);
        }
    }

    /**
     * @param string[] $urls
     */
    private static function purgeUrls(array $urls): void
    {
        do_action('litespeed_purge', self::TAG);

        if (\function_exists('rocket_clean_files')) {
            rocket_clean_files($urls);
        }

        global $nginx_purger;

        foreach ($urls as $url) {
            if (\function_exists('w3tc_flush_url')) {
                w3tc_flush_url($url);
            }

            if (\function_exists('wpsc_delete_url_cache')) {
                wpsc_delete_url_cache($url);
            }

            if (\function_exists('sg_cachepress_purge_cache')) {
                sg_cachepress_purge_cache($url);
            }

            if (\is_object($nginx_purger) && method_exists($nginx_purger, 'purge_url')) {
                $nginx_purger->purge_url($url);
            }

            do_action('cache_enabler_clear_page_cache_by_url', $url);
        }

        // These purge by post: the portal page is the one whose URL they keep.
        $portal = PortalLocation::page();

        if ($portal instanceof WP_Post) {
            do_action('wpfc_clear_post_cache_by_id', false, (int) $portal->ID);
            do_action('wphb_clear_page_cache', (int) $portal->ID);
        }

        do_action('bit_connect_purge_page_cache', $urls);
    }

    private static function purgeEverything(): void
    {
        // LiteSpeed can name the portal's pages alone, so it keeps the rest.
        do_action('litespeed_purge', self::TAG);

        if (\function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
        }

        if (\function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
        }

        if (\function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
        }

        if (\function_exists('sg_cachepress_purge_everything')) {
            sg_cachepress_purge_everything();
        }

        do_action('cache_enabler_clear_complete_cache');
        do_action('wpfc_clear_all_cache');
        do_action('breeze_clear_all_cache');
        do_action('rt_nginx_helper_purge_all');
        do_action('wphb_clear_page_cache');

        do_action('bit_connect_purge_page_cache', null);
    }

    // phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound

    private static function scheduleFlush(): void
    {
        if (self::$flushScheduled) {
            return;
        }

        self::$flushScheduled = true;

        // Ahead of LiteSpeed Cache, which sends its purge header at shutdown:0.
        Hooks::addAction('shutdown', [self::class, 'flush'], -100);
    }

    /**
     * @return string[]
     */
    private static function portalTaxonomies(): array
    {
        $taxonomies = array_map(static fn (Taxonomies $case) => $case->value, Taxonomies::cases());

        foreach (TopicTaxonomies::all() as $entry) {
            $taxonomies[] = $entry['taxonomy'];
        }

        return array_merge($taxonomies, array_values(PortalTaxonomies::map()));
    }

    /**
     * The options the portal's pages are drawn from. Another plugin that adds
     * to the portal names its own through `bit_connect_page_cache_options`.
     *
     * @return string[]
     */
    private static function portalOptions(): array
    {
        $options = array_map([Config::class, 'withPrefix'], [
            'settings',
            'portal_page',
            PortalLocation::ROOT_OPTION,
            GeneralSettings::OPTION_NAME->value,
            AuthSettings::OPTION_NAME->value,
            SeoSettings::OPTION_NAME->value,
        ]);

        $added = Hooks::applyFilter('bit_connect_page_cache_options', []);

        return array_merge($options, \is_array($added) ? $added : []);
    }
}
