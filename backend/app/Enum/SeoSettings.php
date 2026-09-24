<?php

namespace BitApps\BitConnect\Enum;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;

/**
 * Every SEO behaviour an administrator can steer, in one option.
 *
 * The SEO layer shipped with sensible defaults and filter hooks, which covers
 * developers and nobody else. These are the same decisions surfaced as settings:
 * each accessor here is the default a `bit_connect_*` filter still overrides, so
 * a site with custom code keeps behaving exactly as it did.
 *
 * Defaults reproduce the behaviour that existed before this option, so an
 * install that never opens the SEO screen is unaffected by it.
 */
enum SeoSettings: string
{
    case OPTION_NAME = 'seo_settings';

    /**
     * The shipped behaviour, before an administrator changes anything.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            // Which term archives, by URL segment, are offered to search: an
            // indexable archive is also listed in the sitemap, and one that is
            // not is still served to visitors, marked noindex. Subject
            // taxonomies are what people search for, and stage is what the
            // sidebar navigates by; status is a workflow state nobody looks up
            // and nothing links to, and its archives churn constantly.
            'indexArchives' => [
                'topic'      => true,
                'department' => true,
                'tag'        => true,
                // The sidebar navigates by stage, so these are the portal's
                // primary browse pages rather than a workflow filter nobody
                // links to — every page in the portal points at them, and
                // keeping them out of the index would spend that internal
                // linking on pages that cannot rank. `status` stays out: it is
                // still only a filter, with no navigation pointing at it.
                'stage'  => true,
                'status' => false,
            ],

            // Member profiles publish names and activity, so indexing them is
            // the site's call and off until it is made.
            'indexProfiles' => false,
        ];
    }

    /**
     * Stored settings merged over the defaults.
     *
     * Deliberately uncached: `get_option()` is already served from WordPress's
     * options cache, so a second cache here would buy nothing and would need
     * invalidating every time the settings are saved mid-request.
     *
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        $stored = Config::getOption(self::OPTION_NAME->value, []);
        $settings = array_merge(self::defaults(), \is_array($stored) ? $stored : []);

        // Once on the SEO screen, since withdrawn. `serverRendering` switched
        // off every route's title, canonical and structured data along with the
        // HTML; `ssrTopicLimit` is fixed in TopicsView; the two schema switches
        // are the `bit_connect_seo_json_ld` filter; `metaOwner` is gone because
        // a supported SEO plugin is stood down on portal routes — see
        // SeoPluginBridge; paginated list pages are always indexable — see
        // SeoMeta::forTopics(); the sitemap always publishes, lists everything
        // and announces itself, following WordPress's own "discourage search
        // engines" instead — see PortalSitemap. A value saved back then is
        // dropped rather than left to be read.
        unset(
            $settings['serverRendering'],
            $settings['ssrTopicLimit'],
            $settings['schemaDiscussion'],
            $settings['schemaBreadcrumbs'],
            $settings['metaOwner'],
            $settings['indexPagination'],
            $settings['sitemap']
        );

        // Merged one level deep, so an option stored before a segment existed
        // still gets that segment's default rather than a missing key read as
        // "switched off".
        $settings['indexArchives'] = array_merge(
            self::defaults()['indexArchives'],
            \is_array($settings['indexArchives'] ?? null) ? $settings['indexArchives'] : []
        );

        // Archives once had two more switches: whether the route was served at
        // all, and whether an indexable archive was listed in the sitemap. An
        // archive that was switched off comes back served and noindex — the
        // sidebar links to stage archives, so a 404 there broke the portal's own
        // navigation, and noindex already keeps a page out of search. An
        // indexable archive kept out of the sitemap is simply listed now.
        $storedRoutes = \is_array($settings['archives'] ?? null) ? $settings['archives'] : [];

        foreach ($storedRoutes as $segment => $served) {
            if ($served === false && isset($settings['indexArchives'][$segment])) {
                $settings['indexArchives'][$segment] = false;
            }
        }

        unset($settings['archives']);

        return $settings;
    }

    public static function bool(string $key): bool
    {
        return (bool) (self::all()[$key] ?? false);
    }

    /**
     * Whether a term archive is offered to search — indexed, and listed in the
     * sitemap. Every archive is served to visitors either way.
     */
    public static function archiveIndexable(string $segment): bool
    {
        return (bool) (self::all()['indexArchives'][$segment] ?? false);
    }
}
