<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Request\Request;
use BitApps\BitConnect\SSR\Seo\SeoMeta;
use BitApps\BitConnect\SSR\SSRHandler;
use BitApps\BitConnect\Views\BaseView;

/**
 * Serves the portal shell for the sign-in, sign-up, email-verification and
 * password-reset screens.
 *
 * Without these routes the paths fall to the single-segment topic route, which
 * finds no topic by that name and answers 404 — the page still rendered, because
 * the client router took over, but the status told browsers and crawlers the
 * link was broken. Nothing is prepared server-side: the forms are the client's.
 */
class AuthPageController
{
    private $ssrHandler;

    public function __construct($interactiveNamespace = 'bitConnectStore', $rootElementId = 'bit-connect-n-root', $rootElementAttributes = ['data-wp-init' => 'callbacks.postWatcher'])
    {
        $this->ssrHandler = new SSRHandler($interactiveNamespace, $rootElementId, $rootElementAttributes);
    }

    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function login(Request $request)
    {
        return $this->render('/login', __('Log in', 'bit-connect'));
    }

    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function register(Request $request)
    {
        return $this->render('/register', __('Sign up', 'bit-connect'));
    }

    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function verifyEmail(Request $request)
    {
        return $this->render('/verify-email', __('Verify email', 'bit-connect'));
    }

    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- the type hint is the route contract; there is nothing to read off it
    public function forgotPassword(Request $request)
    {
        return $this->render('/forgot-password', __('Reset password', 'bit-connect'));
    }

    /**
     * Render the portal shell so the client router can take over.
     *
     * @return string
     */
    private function render(string $path, string $title)
    {
        // Both steps are needed for the bundle to load; see NotificationsPageController.
        $baseView = new BaseView();
        $baseView->registerAssets();

        SeoMeta::forAuthPage($title);

        return $this->ssrHandler->generateView($path, [], [], []);
    }
}
