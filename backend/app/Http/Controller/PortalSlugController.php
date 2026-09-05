<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
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
                'slug'         => $slug,
                'url'          => get_home_url(null, $slug . '/'),
                'exists'       => $page instanceof WP_Post,
                'isPortal'     => $page instanceof WP_Post && $portal instanceof WP_Post && $page->ID === $portal->ID,
                'hasShortcode' => $page instanceof WP_Post && has_shortcode((string) $page->post_content, 'bit-connect'),
            ]
        );
    }

    /**
     * Create the portal page under a slug — the onboarding wizard's one-time
     * setup. Refuses a slug something else already answers to: the wizard has
     * already told the administrator to pick another name.
     */
    public function createPage(CreatePortalPageRequest $request): Response
    {
        $slug = $request->sanitizedSlug();
        if ($slug === '') {
            return Response::error('Slug is required', 422);
        }

        if (PortalLocation::pageBySlug($slug) instanceof WP_Post) {
            return Response::error('A page with that slug already exists', 409);
        }

        if (self::createPortalPage($slug) === 0) {
            return Response::error('Failed to create the portal page', 500);
        }

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
                'hasShortcode' => $page instanceof WP_Post && has_shortcode((string) $page->post_content, 'bit-connect'),
                'editUrl'      => $page instanceof WP_Post ? (string) get_edit_post_link($page->ID, 'raw') : '',
                'root'         => PortalLocation::isRoot(),
                'frontPageOk'  => PortalLocation::isFrontPageBound(),
            ]
        );
    }

    /**
     * Turn root mode on or off.
     *
     * Enabling binds the portal page to the front page: that is what makes `/`
     * the topics list and what makes the router basename resolve to the install
     * root. Disabling unbinds it again — left bound, `/` and `/{slug}/` would
     * both serve the portal index as duplicate content.
     */
    public function updateRootMode(UpdatePortalRootModeRequest $request): Response
    {
        $enabled = $request->isEnabled();

        $page = PortalLocation::page();

        if ($enabled && !$page) {
            return Response::error('Create the community page before showing it as the homepage', 409);
        }

        Config::updateOption(PortalLocation::ROOT_OPTION, $enabled ? 1 : 0, true);

        if ($enabled && $page) {
            update_option('show_on_front', 'page');
            update_option('page_on_front', $page->ID);
        } elseif (!$enabled && $page && (int) get_option('page_on_front') === $page->ID) {
            // Only undo the binding this controller created; a front page pointing
            // anywhere else is the administrator's own and is left alone.
            update_option('show_on_front', 'posts');
            update_option('page_on_front', 0);
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

        Config::updateOption('portal_page', $slug, true);
        $this->invalidateRewriteRules();

        $page = PortalLocation::page();

        return Response::success(
            [
                'url'          => PortalLocation::url(),
                'slug'         => $slug,
                'pageExists'   => $page instanceof WP_Post,
                'hasShortcode' => $page instanceof WP_Post && has_shortcode((string) $page->post_content, 'bit-connect'),
            ]
        );
    }

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

        if (!empty($existing)) {
            return $existing[0]->ID;
        }

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
     * Create a standalone WordPress page that embeds the portal via the
     * [bit-connect] shortcode.
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
                'post_content'   => '[bit-connect]',
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
            wp_set_post_terms($tpl->ID, [get_stylesheet()], 'wp_theme');
        }

        return $page->ID;
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
