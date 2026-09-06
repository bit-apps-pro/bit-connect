<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\BaseView;

/**
 * Serves the portal shell for `/user/{id}`.
 *
 * The static router only knows the routes declared in hooks/static.php, and it
 * had none with two segments — so the profile URL fell through to WordPress and
 * 404'd before the app ever booted. This exists to claim that path.
 *
 * No data is prepared server-side: a profile is not prerendered (the route is
 * dynamic, which the prerender step skips), and its contents are public but
 * uninteresting to crawlers compared with the topics themselves. The client
 * fetches everything once React Router takes over.
 */
class UserProfilePageController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-u-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    /**
     * Render the portal shell so the client router can take over.
     *
     * @param string $userId
     *
     * @return string
     */
    public function show(Request $request, $userId) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        // Both steps are needed for the bundle to load: constructing BaseView
        // hooks wp_enqueue_scripts, and registerAssets() declares the script
        // modules that hook then enqueues. Without them the route renders the
        // loading shell and React never boots.
        $baseView = new BaseView();
        $baseView->registerAssets();

        // Without this the profile inherits the portal page's title and
        // canonical, so every member URL competes with the portal itself for the
        // same listing. Profiles are thin and assembled client-side, so they are
        // kept out of the index rather than given meta of their own — `follow`
        // still lets the member's topics be discovered from here.
        SeoMeta::forProfile(self::displayName($userId));

        return $this->ssrHandler->generateView('/user/' . $userId, [], [], []);
    }

    /**
     * Display name behind a profile path segment, which may be an id or a slug.
     *
     * @param string $userId
     */
    private static function displayName($userId): string
    {
        $resolved = ctype_digit((string) $userId)
            ? (int) $userId
            : ProfileSlugService::resolve($userId);

        if ($resolved <= 0) {
            return '';
        }

        $user = get_userdata($resolved);

        return $user === false ? '' : (string) $user->display_name;
    }
}
