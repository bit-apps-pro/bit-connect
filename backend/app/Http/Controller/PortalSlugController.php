<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\CheckPortalSlugRequest;
use BitApps\BitConnect\Http\Requests\CreatePortalPageRequest;
use BitApps\BitConnect\Http\Requests\GetPortalPageRequest;
use BitApps\BitConnect\Http\Requests\UpdatePortalRootModeRequest;
use BitApps\BitConnect\Http\Requests\UpdatePortalSlugRequest;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Views\PortalBlock;
use WP_Post;

/**
 * Placement of the portal: which slug answers to it, and whether it is the
 * site's front page.
 *
 * Every action takes a Request, and that is load-bearing rather than stylistic.
 * The API router only runs authorize() when it resolves a Request subclass from
 * the action's own signature, and it registers routes with a permissive
 * permission_callback — so an action here that took no Request would answer
 * anyone on the internet, including the two that write show_on_front and
 * page_on_front. Do not remove these parameters.
 */
final class PortalSlugController
{
    /**
     * What is at a slug right now — for the live hint under a slug field.
     */
    public function checkSlug(CheckPortalSlugRequest $request): Response
    {
        $slug = $request->sanitizedSlug();
        if ($slug === '') {
            return Response::error('Slug is required', 422);
        }

        $page = PortalLocation::pageBySlug($slug);
        $portal = PortalLocation::page();

        return Response::success(
            [
                'slug'   => $slug,
                'url'    => get_home_url(null, $slug . '/'),
                'exists' => $page instanceof WP_Post,
                // Nothing may live here: WordPress routes on this segment itself.
                'reserved' => PortalLocation::isReservedSlug($slug),
                // A new page can be created under exactly this slug.
                'available'    => !$page instanceof WP_Post && PortalLocation::isSlugFree($slug),
                'isPortal'     => $page instanceof WP_Post && $portal instanceof WP_Post && $page->ID === $portal->ID,
                'hasShortcode' => $page instanceof WP_Post && PortalLocation::embedsPortal((string) $page->post_content),
            ]
        );
    }

    /**
     * Create the portal page under a slug — from the onboarding wizard, or from
     * the settings screen when the saved slug has no page behind it. Refuses a
     * slug something else already answers to: the screen has already told the
     * administrator to pick another name.
     */
    public function createPage(CreatePortalPageRequest $request): Response
    {
        $slug = $request->sanitizedSlug();
        if ($slug === '') {
            return Response::error('Slug is required', 422);
        }

        if (PortalLocation::pageBySlug($slug) instanceof WP_Post) {
            return Response::error(__('A page with that slug already exists.', 'bit-connect'), 409);
        }

        if (!PortalLocation::isSlugFree($slug)) {
            return Response::error(__('That address is already used by something else on your site. Please choose another.', 'bit-connect'), 409);
        }

        $pageId = self::createPortalPage($slug);
        $page = $pageId === 0 ? null : get_post($pageId);

        if (!$page instanceof WP_Post) {
            return Response::error(__('Failed to create the portal page.', 'bit-connect'), 500);
        }

        // The stored slug, not the requested one: the page is the truth, and a
        // pointer that names anything else names nothing.
        $slug = $page->post_name;
        Config::updateOption('portal_page', $slug, true);
        $this->invalidateRewriteRules();

        return Response::success(['slug' => $slug, 'url' => PortalLocation::url()]);
    }

    public function getPage(GetPortalPageRequest $_request): Response // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        $slug = (string) Config::getOption('portal_page');
        $page = PortalLocation::page();

        // `exists` is whether a published page actually carries the portal — not
        // whether the option is set. A slug pointing at a deleted page is the
        // case the settings screen most needs to be told about.
        return Response::success(
            [
                'slug'         => $slug,
                'url'          => $slug === '' ? '' : PortalLocation::url(),
                'configured'   => $slug !== '',
                'exists'       => $page instanceof WP_Post,
                'hasShortcode' => $page instanceof WP_Post && PortalLocation::embedsPortal((string) $page->post_content),
                'editUrl'      => $page instanceof WP_Post ? (string) get_edit_post_link($page->ID, 'raw') : '',
                'root'         => PortalLocation::isRoot(),
                'frontPageOk'  => PortalLocation::isFrontPageBound(),
                // Both writes reach past the forum into the site itself, so each
                // answers to the core capability that governs it — the screen
                // offers only what the current user may actually do.
                'canCreatePage'   => current_user_can('publish_pages'),
                'canSetFrontPage' => current_user_can('manage_options'),
                // `/{slug}/…` is a rewrite; with plain permalinks there are none.
                'prettyPermalinks' => (string) get_option('permalink_structure') !== '',
                'permalinksUrl'    => current_user_can('manage_options') ? admin_url('options-permalink.php') : '',
            ]
        );
    }

    /**
     * Turn root mode on or off.
     *
     * Enabling binds the portal page to the front page: that is what makes `/`
     * the topics list and what makes the router basename resolve to the install
     * root. Disabling unbinds it again — left bound, `/` and `/{slug}/` would
     * both serve the portal index as duplicate content — and hands the homepage
     * back to whatever held it before.
     */
    public function updateRootMode(UpdatePortalRootModeRequest $request): Response
    {
        $enabled = $request->isEnabled();

        $page = PortalLocation::page();

        if ($enabled && !$page) {
            return Response::error(__('Create the community page before showing it as the homepage.', 'bit-connect'), 409);
        }

        Config::updateOption(PortalLocation::ROOT_OPTION, $enabled ? 1 : 0, true);

        if ($enabled && $page) {
            $this->rememberFrontPage($page);
            update_option('show_on_front', 'page');
            update_option('page_on_front', $page->ID);
        } elseif ($page && (int) get_option('page_on_front') === $page->ID) {
            // Only undo the binding this controller created; a front page pointing
            // anywhere else is the administrator's own and is left alone.
            $this->restoreFrontPage();
        }

        $this->invalidateRewriteRules();

        return Response::success(['enabled' => $enabled, 'url' => PortalLocation::url()]);
    }

    /**
     * Point the portal at a slug.
     *
     * A pointer, nothing more — like bbPress's forum root. No page is created
     * or renamed: the administrator makes the page (or renames their existing
     * one) themselves, and the response says whether one is there yet so the
     * settings screen can say so too.
     */
    public function updateSlug(UpdatePortalSlugRequest $request): Response
    {
        $slug = $request->sanitizedSlug();
        if ($slug === '') {
            return Response::error('Slug is required', 422);
        }

        if (PortalLocation::isReservedSlug($slug)) {
            return Response::error(__('WordPress already uses that address for another part of your site. Please choose another.', 'bit-connect'), 422);
        }

        Config::updateOption('portal_page', $slug, true);
        $this->invalidateRewriteRules();

        $page = PortalLocation::page();

        return Response::success(
            [
                'url'          => PortalLocation::url(),
                'slug'         => $slug,
                'pageExists'   => $page instanceof WP_Post,
                'hasShortcode' => $page instanceof WP_Post && PortalLocation::embedsPortal((string) $page->post_content),
            ]
        );
    }

    /**
     * Make the portal template exist and belong to the active theme.
     *
     * A block theme only lists a wp_template whose `wp_theme` term names it, so
     * the term is set on every call, not just on creation: this also runs on
     * activation and on every theme switch, and a template still tagged with
     * the previous theme is invisible to the page editor's template picker.
     *
     * @return int the template's post id, or 0 when creation failed
     */
    public static function ensurePortalTemplate(): int
    {
        $existing = get_posts(
            [
                'name'        => 'bit-connect-portal',
                'numberposts' => 1,
                'post_type'   => 'wp_template',
                'post_status' => 'any',
            ]
        );

        $id = empty($existing) ? self::insertPortalTemplate() : $existing[0]->ID;

        if ($id > 0) {
            wp_set_post_terms($id, [get_stylesheet()], 'wp_theme');
        }

        return $id;
    }

    /**
     * Create a standalone WordPress page that embeds the portal.
     *
     * As the block rather than the `[bit-connect]` shortcode: the two render
     * the same portal, but only a block can show itself in the editor and in
     * the template picker.
     *
     * This is NOT by itself the SSR portal route — that is controlled by the
     * `portal_page` option, which createPage() only points here when no portal
     * is configured yet.
     *
     * @return int the new page id, or 0 when creation failed
     */
    public static function createPortalPage(string $slug): int
    {
        $template = self::ensurePortalTemplate();

        $pageId = wp_insert_post(
            [
                'post_title'     => ucfirst($slug),
                'post_name'      => $slug,
                'post_type'      => 'page',
                'post_content'   => PortalBlock::MARKUP,
                'post_status'    => 'publish',
                'comment_status' => 'closed',
                'ping_status'    => 'closed',
            ]
        );

        if (is_wp_error($pageId) || $pageId <= 0 || !($page = get_post($pageId))) {
            return 0;
        }

        // Assign the clean Bit Connect Portal template to the page.
        if ($template > 0 && ($tpl = get_post($template))) {
            update_post_meta($page->ID, '_wp_page_template', $tpl->post_name);
        }

        return $page->ID;
    }

    /**
     * Note what the homepage is before root mode replaces it.
     *
     * Skipped when the portal page already is the front page: that is this
     * controller's own binding (or the administrator's, made by hand), and
     * recording it would make "what was there before" the portal itself.
     */
    private function rememberFrontPage(WP_Post $portal): void
    {
        $showOnFront = (string) get_option('show_on_front', 'posts');
        $pageOnFront = (int) get_option('page_on_front', 0);

        if ($showOnFront === 'page' && $pageOnFront === $portal->ID) {
            return;
        }

        Config::updateOption(
            PortalLocation::PREVIOUS_FRONT_OPTION,
            ['show_on_front' => $showOnFront, 'page_on_front' => $pageOnFront]
        );
    }

    /**
     * Hand the homepage back to what held it before root mode.
     *
     * A static homepage returns only if its page is still published; anything
     * else — it was the posts index, or the page has since gone — falls back
     * to the posts index, which is also core's own answer to a front page that
     * no longer exists.
     */
    private function restoreFrontPage(): void
    {
        $previous = Config::getOption(PortalLocation::PREVIOUS_FRONT_OPTION, []);
        $previous = \is_array($previous) ? $previous : [];
        $pageId = (int) ($previous['page_on_front'] ?? 0);

        $restorePage = ($previous['show_on_front'] ?? '') === 'page'
            && $pageId > 0
            && get_post_status($pageId) === 'publish';

        update_option('show_on_front', $restorePage ? 'page' : 'posts');
        update_option('page_on_front', $restorePage ? $pageId : 0);

        Config::deleteOption(PortalLocation::PREVIOUS_FRONT_OPTION);
    }

    private static function insertPortalTemplate(): int
    {
        $id = wp_insert_post(
            [
                'post_title'   => 'Bit Connect Portal Template',
                'post_name'    => 'bit-connect-portal',
                'post_content' => '<!-- wp:post-content /-->',
                'post_status'  => 'publish',
                'post_type'    => 'wp_template',
                'post_excerpt' => 'Clean template for Bit Connect portal with only post content block',
            ]
        );

        return is_wp_error($id) ? 0 : $id;
    }

    /**
     * Forget everything derived from the portal's placement after changing it.
     *
     * Rewrite rules: not flush_rewrite_rules(): this runs in a REST request whose
     * `init` already registered rules from the *old* option value, so flushing
     * would re-persist the stale set. Clearing the option makes core rebuild on
     * the next front-end request, once StaticRouter and registerProfileRewrite
     * have seen the new slug.
     */
    private function invalidateRewriteRules(): void
    {
        delete_option('rewrite_rules');
        PortalLocation::resetCache();
    }
}
