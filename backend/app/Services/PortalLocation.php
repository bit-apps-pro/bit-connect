<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\PostTypes;
use WP_Comment;
use WP_Post;

/**
 * Where the portal lives, and how its URLs are built.
 *
 * Two placements are supported:
 *
 *   slug mode  — the portal is a page under its own slug, `/community/…`, with
 *                rewrites scoped beneath it (StaticRouter).
 *   root mode  — the portal is the site's front page and owns the URL space of
 *                the WordPress install, `/…` (RootRouter).
 *
 * Root mode does NOT blank out `portal_page`: the page still has to be findable
 * to be queried, set as the front page, and renamed. It is a separate flag, so
 * every consumer that looks up the page by slug keeps working unchanged and only
 * URL *building* has to know the difference.
 *
 * "Root" is relative to the WordPress install, not the domain — a subdirectory
 * install at `example.com/forum` roots the portal at `/forum/`. Everything here
 * goes through home_url(), which already carries that path.
 */
final class PortalLocation
{
    public const ROOT_OPTION = 'portal_root';

    /**
     * In-app routes the SPA renders itself, relative to the portal's base.
     */
    private const AUTH_ROUTES = ['login', 'register'];

    /**
     * Memo for isFrontPageBound(), which the sitemap would otherwise re-query
     * once per URL.
     *
     * @var null|bool
     */
    private static $frontPageBound;

    /**
     * Memo for page(); false means "looked up, absent".
     *
     * @var null|false|WP_Post
     */
    private static $pageCache;

    /**
     * Whether root mode is switched on.
     *
     * This is the raw setting. Routing and URL building must use
     * isServingAtRoot() instead — the setting alone does not mean the portal is
     * reachable at the root.
     */
    public static function isRoot(): bool
    {
        $root = (bool) Config::getOption(self::ROOT_OPTION, false);

        /*
         * Whether the portal is served at the install root.
         *
         * Lets a staging site or a must-use plugin pin the placement without
         * touching the saved setting.
         *
         * @param bool $root the saved setting
         */
        return (bool) Hooks::applyFilter('bit_connect/portal_root', $root);
    }

    /**
     * Whether the portal is actually being served at the install root.
     *
     * Root mode that is switched on but not front-page bound is a broken
     * half-state: nothing serves `/`, so building root URLs would point every
     * canonical, sitemap entry and CPT redirect at a URL that 404s — and the CPT
     * redirect would bounce against WordPress's 404 permalink guessing in an
     * endless loop. Treating it as "not at root" degrades cleanly back to slug
     * URLs while the admin notice asks for the front page to be set.
     */
    public static function isServingAtRoot(): bool
    {
        return self::isRoot() && self::isFrontPageBound();
    }

    /**
     * Forget memoised lookups after the underlying options change.
     */
    public static function resetCache(): void
    {
        self::$frontPageBound = null;
        self::$pageCache = null;
    }

    /**
     * The configured portal slug, without surrounding slashes.
     */
    public static function slug(): string
    {
        $slug = trim((string) Config::getOption('portal_page', ''), '/');

        /*
         * The portal page's slug.
         *
         * A code-level override for sites that deploy the same setup to several
         * environments. The page carrying the portal must still exist under
         * the returned slug.
         *
         * @param string $slug the saved slug
         */
        return trim((string) Hooks::applyFilter('bit_connect/portal_slug', $slug), '/');
    }

    /**
     * The published page carrying the portal, or null when none exists.
     */
    public static function page(): ?WP_Post
    {
        if (self::$pageCache !== null) {
            return self::$pageCache === false ? null : self::$pageCache;
        }

        $slug = self::slug();
        $page = $slug === '' ? null : self::pageBySlug($slug);
        self::$pageCache = $page ?? false;

        return $page;
    }

    /**
     * Make this page the portal when no working portal exists yet.
     *
     * A site owner who drops `[bit-connect]` on a page of their own — instead of
     * letting the wizard create one — gets an app whose router basename is that
     * page, while every rewrite rule, canonical and notification link is still
     * built from `portal_page`. If that option is empty, or names a page that has
     * since been deleted or unpublished, nothing serves deep links at all and the
     * page is the only candidate there is, so it takes the slot.
     *
     * A page that *does* resolve is left alone: a second shortcode page is an
     * embed, never a takeover, otherwise two pages would hand the portal back
     * and forth on every view and re-flush the rewrites each time.
     *
     * @return bool whether the option was changed
     */
    public static function adoptPage(WP_Post $page): bool
    {
        if ($page->post_type !== 'page' || $page->post_status !== 'publish' || $page->post_name === '') {
            return false;
        }

        if ($page->post_name === self::slug() || self::page() instanceof WP_Post) {
            return false;
        }

        Config::updateOption('portal_page', $page->post_name, true);

        // Rules for this request were already registered from the old slug;
        // clearing the stored set makes core rebuild on the next request, once
        // StaticRouter has seen the new one.
        delete_option('rewrite_rules');
        self::resetCache();

        return true;
    }

    /**
     * The published page with this slug, or null.
     */
    public static function pageBySlug(string $slug): ?WP_Post
    {
        $pages = get_posts(
            [
                'name'           => $slug,
                'post_type'      => 'page',
                'post_status'    => 'publish',
                'posts_per_page' => 1,
            ]
        );

        return $pages[0] ?? null;
    }

    /**
     * Absolute URL of a portal route.
     *
     * @param string $path in-app path, e.g. 'hello-world' or 'user/12'
     */
    public static function url(string $path = ''): string
    {
        $suffix = $path === '' ? '' : '/' . ltrim($path, '/');

        if (self::isServingAtRoot()) {
            return home_url($suffix === '' ? '/' : $suffix);
        }

        return home_url('/' . self::slug() . $suffix);
    }

    /**
     * Point WordPress's own comment links at the portal.
     *
     * `get_comment_link()` builds from the CPT permalink, `/bit-connect/{slug}/`,
     * which is never where a topic is read — PortalSitemap 301s that URL to the
     * portal route. The redirect rescues a full page load but not a link handed
     * to the SPA router, which has no such route and lands on its 404 instead.
     * Every consumer went through this one function, so correcting it here fixes
     * notification targets, report links and moderation mail together rather
     * than in five places that could drift apart.
     */
    public static function registerLinkFilters(): void
    {
        Hooks::addFilter('get_comment_link', [self::class, 'filterCommentLink'], 10, 2);
    }

    /**
     * Adopt a hand-made shortcode page the moment it is published, rather than
     * waiting for a visitor to render it — so the administrator who just pressed
     * Publish can open a topic link straight away.
     */
    public static function registerAdoptionHooks(): void
    {
        Hooks::addAction('save_post_page', [self::class, 'adoptOnSave'], 10, 2);
    }

    /**
     * Adopt a freshly saved page (save_post_page callback).
     *
     * @param int     $postId
     * @param WP_Post $post
     */
    public static function adoptOnSave($postId, $post): void
    {
        if (!$post instanceof WP_Post || wp_is_post_revision($postId) || wp_is_post_autosave($postId)) {
            return;
        }

        if (!has_shortcode((string) $post->post_content, 'bit-connect')) {
            return;
        }

        self::adoptPage($post);
    }

    /**
     * The portal's address for a comment, falling back to what core built.
     *
     * @param string          $link    the CPT-based link core built
     * @param null|WP_Comment $comment the comment it points at
     */
    public static function filterCommentLink($link, $comment = null): string
    {
        if (!$comment instanceof WP_Comment) {
            return (string) $link;
        }

        $portal = self::commentUrl($comment);

        // Not a forum comment — someone else's post type, and none of the
        // portal's business.
        return $portal === '' ? (string) $link : $portal;
    }

    /**
     * Absolute portal URL of a topic, or '' when the post is not a topic.
     *
     * @param int|WP_Post $post
     */
    public static function topicUrl($post): string
    {
        $topic = $post instanceof WP_Post ? $post : get_post((int) $post);

        if (!$topic instanceof WP_Post || $topic->post_type !== PostTypes::BIT_CONNECT->value) {
            return '';
        }

        // post_name, not the permalink: a non-ASCII slug is stored
        // percent-encoded and that is the form the route matches on.
        return $topic->post_name === '' ? '' : self::url($topic->post_name);
    }

    /**
     * Absolute portal URL of a single comment, or '' when it is not on a topic.
     *
     * The `#comment-{id}` fragment is WordPress's own convention, which the
     * portal's comment list now answers to — so a link built before this
     * existed still resolves.
     *
     * @param int|WP_Comment $comment
     */
    public static function commentUrl($comment): string
    {
        $target = $comment instanceof WP_Comment ? $comment : get_comment((int) $comment);

        if (!$target instanceof WP_Comment) {
            return '';
        }

        $topicUrl = self::topicUrl((int) $target->comment_post_ID);

        return $topicUrl === '' ? '' : $topicUrl . '#comment-' . (int) $target->comment_ID;
    }

    /**
     * Whether the portal itself answers this URL with its own login/register
     * screen.
     *
     * Custom-URL mode hands sign-in to another page, so a value pointing back at
     * a route the SPA renders would bounce the visitor between the portal and
     * itself forever. Only the server can answer this:
     *
     *   slug mode  — `/{slug}/login` is claimed unconditionally, by the rewrite
     *                catch-all scoped beneath the portal page.
     *   root mode  — `/login` is claimed only when WordPress has nothing there,
     *                because RootRouter routes on the 404. `/login` is also
     *                exactly where a membership plugin puts its own page, and
     *                that page outranks the portal — so a real page there makes
     *                the URL a perfectly good destination, not a loop.
     *
     * The client used to decide this from the router basename alone, which in
     * root mode is empty and made every `/login` on the site look like the
     * portal's own.
     */
    public static function ownsAuthRoute(string $url): bool
    {
        $path = self::installRelativePath($url);

        if ($path === null) {
            return false;
        }

        if (self::isServingAtRoot()) {
            return \in_array($path, self::AUTH_ROUTES, true) && url_to_postid($url) === 0;
        }

        $slug = self::slug();

        if ($slug === '') {
            return false;
        }

        foreach (self::AUTH_ROUTES as $route) {
            if ($path === $slug . '/' . $route) {
                return true;
            }
        }

        return false;
    }

    /**
     * Whether root mode is actually serviceable.
     *
     * Root mode hangs the portal off the front page: that is what makes `/` the
     * topics list, and what makes get_permalink() — and therefore the router
     * basename handed to the client — resolve to the install root. If the front
     * page is pointed elsewhere the portal cannot claim `/`, so this is checked
     * before routing rather than assumed.
     */
    public static function isFrontPageBound(): bool
    {
        if (self::$frontPageBound !== null) {
            return self::$frontPageBound;
        }

        $page = self::page();

        self::$frontPageBound = $page instanceof WP_Post
            && get_option('show_on_front') === 'page'
            && (int) get_option('page_on_front') === $page->ID;

        return self::$frontPageBound;
    }

    /**
     * The URL's path relative to the WordPress install, or null when the URL
     * belongs to somewhere else entirely.
     *
     * A subdirectory install at `example.com/forum` carries that prefix in every
     * one of its URLs while the portal's own paths are stated without it, so the
     * prefix has to come off before anything can be compared. A value with no
     * host is site-relative and therefore this site's — that is what an
     * administrator typing `/login` means.
     */
    private static function installRelativePath(string $url): ?string
    {
        $parts = wp_parse_url(trim($url));

        if (!\is_array($parts)) {
            return null;
        }

        $home = wp_parse_url(home_url('/'));
        $home = \is_array($home) ? $home : [];

        $host = $parts['host'] ?? null;
        $homeHost = $home['host'] ?? null;

        if (\is_string($host) && \is_string($homeHost) && strcasecmp($host, $homeHost) !== 0) {
            return null;
        }

        $path = trim((string) ($parts['path'] ?? ''), '/');
        $base = trim((string) ($home['path'] ?? ''), '/');

        if ($base === '') {
            return $path;
        }

        if ($path === $base) {
            return '';
        }

        return strpos($path, $base . '/') === 0 ? substr($path, \strlen($base) + 1) : null;
    }
}
