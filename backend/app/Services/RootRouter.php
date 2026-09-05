<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Controller\NotFoundController;
use BitApps\BitConnect\Http\Controller\NotificationsPageController;
use BitApps\BitConnect\Http\Controller\TopicArchiveController;
use BitApps\BitConnect\Http\Controller\TopicDetailsController;
use BitApps\BitConnect\Http\Controller\TopicsController;
use BitApps\BitConnect\Http\Controller\UserProfilePageController;
use WP;
use WP_Post;
use WP_Query;

/**
 * Serves the portal from the root of the WordPress install.
 *
 * Rewrite rules cannot express this. With `/%postname%/` permalinks WordPress's
 * own `^([^/]+)/?$` rule is already a catch-all: it matches every top-level URL,
 * finds no post, and 404s. A portal rule added at 'top' would hijack the whole
 * site; one added at 'bottom' would never be reached. There is no priority that
 * works, so root mode routes on the 404 instead of on a rewrite.
 *
 * The rule that keeps this safe is **resolve before claiming**: a request is
 * taken over only once a published topic is known to exist at that slug. Pages,
 * posts, feeds and archives never 404, so they are never even considered; a
 * genuine typo stays a genuine 404 rather than becoming a soft 200. That is also
 * what removes the need for the manual URL exclusion list this feature usually
 * ships with elsewhere — WordPress keeps winning by default.
 */
final class RootRouter
{
    /**
     * Whether this request has been taken over.
     *
     * The shortcode consults this: the portal page's own content is
     * `[bit-connect]`, and rendering it on a claimed request would put a second
     * app root on the page.
     */
    private static bool $claimed = false;

    private string $content = '';

    public function __construct()
    {
        // 'wp' fires after the main query is parsed and handle_404() has run,
        // and before template_redirect — so is_404() is meaningful here, and the
        // takeover lands before redirect_canonical and the template loader.
        Hooks::addAction('wp', [$this, 'route']);
    }

    public static function hasClaimed(): bool
    {
        return self::$claimed;
    }

    /**
     * Show the front-page warning without constructing a router.
     *
     * Root mode that is not front-page bound falls back to the slug router, so
     * this instance never exists on the requests that most need the warning.
     */
    public static function registerFrontPageNotice(): void
    {
        Hooks::addAction('admin_notices', [self::class, 'renderFrontPageNotice']);
    }

    /**
     * Decide whether this request belongs to the portal, and take it over if so.
     *
     * @param WP $wp
     */
    public function route($wp): void
    {
        if (is_admin() || wp_doing_ajax() || (\defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }

        $portal = PortalLocation::page();

        if (!$portal instanceof WP_Post || !PortalLocation::isServingAtRoot()) {
            return;
        }

        // WP::$request is the path relative to the install root, already stripped
        // of a subdirectory prefix — which is what makes `example.com/forum`
        // behave identically to `forum.example.com`.
        $path = trim((string) $wp->request, '/');

        if ($path === '') {
            // The front page query is already the portal page, so only the render
            // has to be attached — no requery, and the URL and query agree.
            if (is_front_page()) {
                $this->render(static fn () => (new TopicsController())->index(new Request()));
            }

            return;
        }

        // Deeper pages of the list, e.g. `/page/3`.
        //
        // Checked *before* the resolved-content guard below, which is the one
        // exception to resolve-before-claim. With a static front page WordPress
        // answers `/page/N` with the front page's own pagination, so it never
        // 404s and the guard would return — leaving the theme to render page N
        // of a portal page whose only content is the `[bit-connect]` shortcode.
        // That URL space is the portal's list, not the page's, so it is claimed
        // outright. The controller turns a page past the end into a 404 rather
        // than an empty listing.
        if (preg_match('~^page/([0-9]+)$~', $path, $matches)) {
            $page = (int) $matches[1];

            if ($page > 1) {
                $this->claim($portal, static fn () => (new TopicsController())->index(new Request(), $page));

                return;
            }
        }

        $unresolved = is_404();

        // Anything WordPress resolved is real content and outranks the portal —
        // an attachment aside.
        //
        // Media slugs are minted from upload filenames, so they land squarely on
        // URLs the portal publishes: a picture uploaded as `Aiden-Carter.webp`
        // takes `aiden-carter`, which is that member's own profile, and any
        // topic created after an upload can collide too, because WordPress only
        // keeps an attachment slug unique against posts that already exist. Both
        // resolve to the attachment, so the guard hands the request back and
        // canonical then 301s the visitor to the raw image.
        //
        // Looking past one costs nothing: with attachment pages off, WordPress's
        // own answer for that URL *is* that 301, so there is no page to lose.
        // Resolve-before-claim still decides the outcome — the portal only takes
        // the URL if it genuinely publishes something there, and when it does
        // not the request is handed back and the 301 stands.
        $onlyAnAttachment = is_attachment() && !get_option('wp_attachment_pages_enabled');

        if (!$unresolved && !$onlyAnAttachment) {
            return;
        }

        // The member's own notifications. Claimed outright with no resolve step,
        // unlike everything else here: there is nothing to resolve against. The
        // page belongs to whoever is logged in, exists for every member and for
        // none of them in particular, and the shell answers a signed-out visitor
        // itself rather than 404ing at somebody who followed a link from their
        // own email.
        if ($path === 'notifications') {
            $this->claim($portal, static fn () => (new NotificationsPageController())->show(new Request()));

            return;
        }

        if (preg_match('~^user/([^/]+)$~', $path, $matches)) {
            $userId = $matches[1];

            // A /user/ URL naming nobody is still the profile page's to answer —
            // it reports the member as not found — but only while nothing else
            // answers it.
            if (!$unresolved && !self::isMember($userId)) {
                return;
            }

            $this->claim($portal, static fn () => (new UserProfilePageController())->show(new Request(), $userId));

            return;
        }

        // Term archives, e.g. `/stage/in-progress`. Resolved before claiming for
        // the same reason topics are: a segment that looks like an archive but
        // names no real term stays a 404 rather than becoming a soft 200.
        $archivePattern = '~^(' . PortalTaxonomies::segmentPattern() . ')/([^/]+)$~';

        if (preg_match($archivePattern, $path, $matches)) {
            $segment = $matches[1];
            $termSlug = $matches[2];

            if (PortalTaxonomies::resolve($segment, $termSlug) !== null) {
                $this->claim(
                    $portal,
                    static fn () => (new TopicArchiveController())->show(new Request(), $segment, $termSlug)
                );

                return;
            }
        }

        $topic = strpos($path, '/') === false
            ? get_page_by_path($path, OBJECT, PostTypes::BIT_CONNECT->value)
            : null;

        if ($topic instanceof WP_Post && $this->isReadable($topic)) {
            $this->claim($portal, static fn () => (new TopicDetailsController())->show(new Request(), $path));

            return;
        }

        // The portal publishes nothing here, so an attachment WordPress did
        // resolve keeps the URL — this fallback is for URLs nothing answers.
        if (!$unresolved) {
            return;
        }

        // Nothing on the site answers this URL. At the root the portal *is* the
        // site, so the visitor gets the community's own not-found screen rather
        // than being ejected into the theme's error page — while the response
        // stays a 404, which is what stops the URL being indexed.
        $this->claim($portal, static fn () => (new NotFoundController())->index(new Request()), found: false);
    }

    public function appendContent($content)
    {
        return $content . $this->content;
    }

    /**
     * Warn when root mode is on but the front page has been pointed elsewhere.
     *
     * Enabling the toggle sets the front page, but nothing stops an administrator
     * changing it afterwards in Settings → Reading — at which point the portal
     * silently stops answering `/`. Without this the cause is invisible.
     */
    public static function renderFrontPageNotice(): void
    {
        if (!Capabilities::check('manage_options') || PortalLocation::isFrontPageBound()) {
            return;
        }

        $message = __(
            'Bit Connect is set to serve the portal at the site root, but the front page is not the portal page.',
            'bit-connect'
        ) . ' ' . __(
            'Set Settings → Reading → "Your homepage displays" to the portal page, or turn off root mode in Bit Connect → General.',
            'bit-connect'
        );

        // Dismissible: this shows on every admin screen, and a warning an
        // administrator cannot silence is a nag whether or not it is correct.
        printf('<div class="notice notice-warning is-dismissible"><p>%s</p></div>', esc_html($message));
    }

    /**
     * Whether a `/user/{segment}` path names a real member.
     *
     * Accepts both forms the profile controller resolves: a numeric id, or a
     * slug — current or historic, so a link shared before a rename still counts
     * as naming its member.
     */
    private static function isMember(string $segment): bool
    {
        if (ctype_digit($segment)) {
            return get_userdata((int) $segment) !== false;
        }

        return ProfileSlugService::resolve($segment) > 0;
    }

    /**
     * Whether this reader should be given the topic page at all.
     *
     * Published is the ordinary answer. A hidden topic is the exception: its
     * author and the moderators are served it — marked, and still absent from
     * every listing — and everyone else falls through to the not-found screen
     * as before.
     *
     * The status check has to happen here as well as in TopicService. This runs
     * on the WordPress route, which decided the request was a 404 long before
     * any service was asked, so letting the author through downstream while
     * this line still tested for 'publish' gave them a 404 on their own topic
     * and an API that cheerfully returned it.
     */
    private function isReadable(WP_Post $topic): bool
    {
        if ($topic->post_status === 'publish') {
            return true;
        }

        return $topic->post_status === ContentVisibilityService::HIDDEN_STATUS
            && ContentVisibilityService::isPostViewableWhileHidden((int) $topic->post_author);
    }

    /**
     * Replace the main query with the portal page, then render into it.
     */
    private function claim(WP_Post $portal, callable $handler, bool $found = true): void
    {
        global $wp_query, $wp_the_query, $post;

        $query = new WP_Query(
            [
                'page_id'             => $portal->ID,
                'post_type'           => 'page',
                'ignore_sticky_posts' => true,
            ]
        );

        $wp_query = $query;
        $wp_the_query = $query;
        $post = get_post($portal->ID);

        if ($found) {
            status_header(200);
        }

        // The URL and the query deliberately disagree on a claimed request: the
        // path is /hello-world while the queried object is the portal page.
        // redirect_canonical rebuilds the canonical URL from the query, so left
        // enabled it would 301 every topic to the front page.
        Hooks::addFilter('redirect_canonical', '__return_false');

        $this->render($handler);
    }

    private function render(callable $handler): void
    {
        self::$claimed = true;

        $this->content = (string) $handler();

        // Same contract StaticRouter uses in slug mode: the controller's output is
        // appended to the portal page's content.
        Hooks::addFilter('the_content', [$this, 'appendContent']);
    }
}
