<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Http\Requests\GetSeoSettingsRequest;
use BitApps\BitConnect\Http\Requests\UpdateSeoSettingsRequest;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\SSR\Seo\PortalSitemap;
use BitApps\BitConnect\SSR\Seo\SeoContent;
use BitApps\BitConnect\SSR\Seo\SeoPluginBridge;

final class SeoSettingsController
{
    public function get(GetSeoSettingsRequest $_request) // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable
    {
        return Response::success(
            [
                'settings'    => SeoSettings::all(),
                'diagnostics' => $this->diagnostics(),
            ]
        );
    }

    public function update(UpdateSeoSettingsRequest $request)
    {
        $data = $request->toSettingsData();

        $added = Config::addOption(SeoSettings::OPTION_NAME->value, $data);

        if (!$added) {
            Config::updateOption(SeoSettings::OPTION_NAME->value, $data);
        }

        // Switching an archive segment on or off changes the rewrite rules the
        // portal registers. Dropping the stored rules makes WordPress rebuild
        // them on the next front-end request — flush_rewrite_rules() here would
        // rebuild them from the REST request's own rule set, which is not the
        // front end's.
        delete_option('rewrite_rules');

        return Response::success(
            [
                'settings'    => $data,
                'diagnostics' => $this->diagnostics(),
            ]
        );
    }

    /**
     * Read-only facts the settings screen needs to be honest about what is live.
     *
     * Without these an administrator cannot tell whether their SEO plugin is
     * winning, whether the portal is exposed to crawlers at all, or how much of
     * the community is actually indexable.
     *
     * @return array<string, mixed>
     */
    private function diagnostics(): array
    {
        $general = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $counts = wp_count_posts(PostTypes::BIT_CONNECT->value);

        $archives = [];

        foreach (PortalTaxonomies::map() as $segment => $taxonomy) {
            $terms = get_terms(['taxonomy' => $taxonomy, 'hide_empty' => true, 'fields' => 'ids']);

            $archives[$segment] = [
                'indexable' => PortalTaxonomies::isIndexable($segment),
                'terms'     => is_wp_error($terms) ? 0 : \count((array) $terms),
            ];
        }

        return [
            'seoPlugin'       => SeoPluginBridge::detect(),
            'isBridged'       => SeoPluginBridge::isBridged(),
            'portalIsPublic'  => ($general['portalAccess'] ?? 'everyone') === 'everyone',
            'crawlerContent'  => SeoContent::isEnabled(),
            'sitemapUrl'      => PortalSitemap::feedUrl(),
            'portalUrl'       => SeoContent::portalUrl(),
            'publishedTopics' => (int) ($counts->publish ?? 0),
            'archives'        => $archives,
        ];
    }
}
