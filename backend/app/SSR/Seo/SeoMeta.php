<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Services\PortalTaxonomies;
use BitApps\BitConnect\Services\TopicSeoService;
use WP_Term;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Document title, canonical, Open Graph and JSON-LD for portal routes.
 *
 * Link preview bots (Slack, Discord, iMessage, X, Facebook) and most AI
 * crawlers read only the document head — they never run the portal's React
 * bundle, so without this every topic URL previews as the portal page's own
 * generic title.
 *
 * Route controllers run on `template_redirect`, which fires before `wp_head`,
 * so the resolved route data is already available by the time this renders.
 */
final class SeoMeta
{
    /**
     * Resolved head data for the matched route, or null when none matched.
     *
     * @var null|array<string, mixed>
     */
    private static $meta;

    /**
     * Describe the topic list route.
     *
     * @param array<int, array<string, mixed>> $topics
     */
    public static function forTopics(array $topics, int $page = 1): void
    {
        if (!SeoContent::isEnabled()) {
            return;
        }

        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');
        $page = max(1, $page);
        $url = SeoContent::pageUrl($page);

        // Pages after the first are indexable and self-canonical, as Google's
        // pagination guidance asks: each is a distinct set of topics under a
        // title naming its page. They were once noindex, but a page left noindex
        // is crawled less and less until its links stop being followed — which
        // is the one job these pages have, reaching topics deeper than the first
        // screenful. Never canonical to page 1, which would disown them.
        $title = $page > 1
            ? \sprintf(
                // translators: 1: community name, 2: page number.
                __('%1$s — page %2$s', 'bit-connect'),
                $community,
                number_format_i18n($page)
            )
            : $community;

        self::$meta = [
            'title'       => $title,
            'description' => self::listDescription($topics, $community),
            // The bare page URL: the list is also served under filter and sort
            // query strings, and every one of those is the same set of topics in
            // a different order. Pointing them all here is what keeps the
            // permutations out of the index.
            'canonical' => $url,
            'image'     => self::siteImage(),
            'type'      => 'website',
            'robots'    => '',
            'jsonLd'    => self::schemaDocuments(self::collectionJsonLd($topics, $title, $url), []),
        ];
    }

    /**
     * Describe a topic detail route.
     *
     * @param null|array<string, mixed> $topic
     */
    public static function forTopic(?array $topic): void
    {
        if (!SeoContent::isEnabled() || empty($topic) || ($topic['post_status'] ?? '') !== 'publish') {
            return;
        }

        $url = SeoContent::portalUrl($topic['post_name'] ?? '');

        // What the author (or a manager) asked the result to say, field by
        // field, over what is derived from the topic. The structured data below
        // keeps the real title and text: a DiscussionForumPosting describes the
        // page's content, and a search title tuned for a snippet is not that.
        $seo = TopicSeoService::sanitize(\is_array($topic['seo'] ?? null) ? $topic['seo'] : []);

        self::$meta = [
            'title'       => $seo['title'] !== '' ? $seo['title'] : ($topic['post_title'] ?? ''),
            'description' => $seo['description'] !== '' ? $seo['description'] : SeoContent::excerpt($topic, 30),
            'canonical'   => $url,
            'image'       => $seo['image'] !== '' ? $seo['image'] : self::topicImage($topic),
            'type'        => 'article',
            'robots'      => '',
            'jsonLd'      => self::schemaDocuments(
                self::discussionJsonLd($topic, $url),
                self::breadcrumbJsonLd($topic['post_title'] ?? '', $url)
            ),
        ];
    }

    /**
     * Describe a term archive route.
     *
     * An archive is the page that can rank for a subject rather than for one
     * question about it, so it carries a title naming the term and a canonical
     * of its own — never the portal page's.
     *
     * @param array<int, array<string, mixed>> $topics
     */
    public static function forArchive(WP_Term $term, array $topics): void
    {
        if (!SeoContent::isEnabled()) {
            return;
        }

        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');
        $url = PortalTaxonomies::urlForTerm($term);

        // Stored escaped ("API &amp; Integrations"). The tags below escape on
        // output, but JSON-LD does not, and would carry the literal "&amp;".
        $termName = wp_specialchars_decode($term->name, ENT_QUOTES);

        // translators: 1: term name, 2: community name.
        $title = \sprintf(__('%1$s — %2$s', 'bit-connect'), $termName, $community);

        $description = $term->description !== ''
            ? wp_trim_words(wp_strip_all_tags($term->description), 30, '…')
            : self::archiveDescription($termName, $community, $topics);

        $indexable = PortalTaxonomies::isIndexable(PortalTaxonomies::segmentFor($term->taxonomy));

        self::$meta = [
            'title'       => $title,
            'description' => $description,
            'canonical'   => $url,
            'image'       => self::siteImage(),
            'type'        => 'website',
            'robots'      => $indexable ? '' : 'noindex,follow',
            // A page kept out of the index has nothing to say to a rich result,
            // and the topics it lists carry their own structured data already.
            'jsonLd' => $indexable ? self::schemaDocuments(
                self::collectionJsonLd($topics, $title, $url),
                self::breadcrumbJsonLd($termName, $url)
            ) : [],
        ];
    }

    /**
     * Describe a member profile route.
     *
     * Kept out of the index by default: a profile is thin, assembled
     * client-side, and publishes a member's name and activity. Without this it
     * inherits the portal page's title and canonical and competes with the
     * topics themselves. `follow` is retained so the topics a member links to
     * are still discovered.
     *
     * @param string $url the profile's own address, its canonical when indexed
     */
    public static function forProfile(string $displayName = '', string $url = ''): void
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');

        $title = $displayName === ''
            // translators: %s: community name.
            ? \sprintf(__('Member profile — %s', 'bit-connect'), $community)
            // translators: 1: member display name, 2: community name.
            : \sprintf(__('%1$s — %2$s', 'bit-connect'), $displayName, $community);

        // Indexed only when the site asks for it — a profile publishes a member's
        // name and activity, which is the owner's call rather than an SEO
        // default. An indexed profile needs a canonical of its own, or it is an
        // indexable page with none; a noindex one must not name one, since
        // noindex beside a canonical pointing elsewhere can carry across.
        $indexable = SeoSettings::bool('indexProfiles') && $displayName !== '' && $url !== '';

        self::$meta = [
            'title'       => $title,
            'description' => $indexable
                // translators: 1: member display name, 2: community name.
                ? \sprintf(__('%1$s’s profile and discussions in the %2$s community.', 'bit-connect'), $displayName, $community)
                : '',
            'canonical' => $indexable ? $url : '',
            'image'     => '',
            'type'      => 'profile',
            'robots'    => $indexable ? '' : 'noindex,follow',
            'jsonLd'    => [],
        ];
    }

    /**
     * Describe the member's own notifications route.
     *
     * Never indexed, and not by preference — the page is one member's private
     * list, it renders a sign-in prompt to everyone else, and there is nothing
     * on it a crawler could reach. `noindex,nofollow` rather than the profile's
     * `noindex,follow`: every link here points at content already discoverable
     * from the listing, so following them gains nothing, and a crawler walking
     * a signed-out shell would only find dead ends.
     *
     * Without this the route inherits the portal page's title and canonical,
     * which would leave every member's bell competing with the forum's own
     * front page for the same listing.
     */
    public static function forNotifications(): void
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');

        self::$meta = [
            'title' => \sprintf(
                // translators: %s: community name.
                __('Notifications — %s', 'bit-connect'),
                $community
            ),
            'description' => '',
            'canonical'   => '',
            'image'       => '',
            'type'        => 'website',
            'robots'      => 'noindex,nofollow',
            'jsonLd'      => [],
        ];
    }

    /**
     * Describe a sign-in, sign-up or password screen.
     *
     * These are forms, not content: they are kept out of search results.
     */
    public static function forAuthPage(string $pageTitle): void
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');

        self::$meta = [
            'title'       => $pageTitle . ' — ' . $community,
            'description' => '',
            'canonical'   => '',
            'image'       => '',
            'type'        => 'website',
            'robots'      => 'noindex,nofollow',
            'jsonLd'      => [],
        ];
    }

    /**
     * Resolved head data for the matched route, or null when none matched.
     *
     * Read by SeoPluginBridge, which stands the site's SEO plugin down on a
     * described route and feeds it the route's title.
     *
     * @return null|array<string, mixed>
     */
    public static function meta(): ?array
    {
        return self::$meta;
    }

    /**
     * Register the head hooks. Safe to call when no route matched — nothing is
     * emitted until a controller has described a route.
     */
    public static function register(): void
    {
        Hooks::addAction('wp_head', [self::class, 'render'], 1);
        Hooks::addFilter('document_title_parts', [self::class, 'filterTitle']);
    }

    /**
     * Replace the document title with the route's own title.
     *
     * @param array<string, string> $parts
     *
     * @return array<string, string>
     */
    public static function filterTitle($parts)
    {
        if (self::$meta === null || empty(self::$meta['title'])) {
            return $parts;
        }

        $parts['title'] = self::$meta['title'];

        // WordPress appends its own "Page N" part whenever the main query is
        // paged. On a claimed route that query is the portal *page*, so the
        // number describes the wrong thing — and a paginated list route already
        // names its page in the title above.
        unset($parts['page']);

        return $parts;
    }

    /**
     * Print the head markup for the matched route.
     */
    public static function render(): void
    {
        // WordPress core prints its own canonical at priority 10, and on a
        // claimed portal route the queried object is still the portal *page* —
        // so core claims every topic and every archive is really the landing
        // page. Core does not dedupe canonicals, so both tags ship and a
        // crawler seeing two conflicting ones honours neither.
        //
        // This matters most on the routes that emit no canonical of their own:
        // a member profile is noindex, and `noindex` on a page whose canonical
        // points at the portal home is the one combination that can carry the
        // noindex across to the home page itself.
        //
        // This hook runs at priority 1, so unhooking here lands before core's
        // would have fired.
        if (self::$meta !== null) {
            Hooks::removeAction('wp_head', 'rel_canonical');
        }

        self::printHead();
    }

    /**
     * Head markup for the matched route, or an empty string when none matched.
     *
     * Captures printHead() so the output can be asserted without echoing.
     */
    public static function head(): string
    {
        ob_start();
        self::printHead();

        return (string) ob_get_clean();
    }

    /**
     * Print the head markup, escaping every value at the tag that carries it.
     */
    private static function printHead(): void
    {
        if (self::$meta === null) {
            return;
        }

        // The first-paint styles and the crawler/human view toggle that used to
        // be printed here as raw <style>/<script> are enqueued instead — see
        // PrePaint, enqueued from BaseView on exactly the requests that render
        // this markup. They still land in the head ahead of <body>.

        // A route we mark noindex must stay out of the index whether or not an
        // SEO plugin is installed. A supported plugin's own robots tag, which
        // describes the portal page, is stood down by SeoPluginBridge.
        if (!empty(self::$meta['robots'])) {
            printf("<meta name=\"robots\" content=\"%s\" />\n", esc_attr(self::$meta['robots']));
        }

        // Yoast and All in One SEO would otherwise print a WebPage and
        // BreadcrumbList describing the portal page beside these, and Rank Math
        // an Article; SeoPluginBridge stands their graphs down on this route.
        foreach ((array) (self::$meta['jsonLd'] ?? []) as $document) {
            if (empty($document)) {
                continue;
            }

            // JSON_HEX_TAG is load-bearing, not cosmetic: topic titles and reply
            // bodies land inside a <script> block, so a post titled
            // `</script><img src=x onerror=…>` would otherwise close the tag and
            // execute. Hex-encoding < and > makes a break-out impossible.
            wp_print_inline_script_tag(
                (string) wp_json_encode($document, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ['type' => 'application/ld+json']
            );
        }

        if (!self::shouldEmitSocialTags()) {
            return;
        }

        $tags = [
            ['name', 'description', self::$meta['description']],
            ['property', 'og:type', self::$meta['type']],
            ['property', 'og:title', self::$meta['title']],
            ['property', 'og:description', self::$meta['description']],
            ['property', 'og:url', self::$meta['canonical']],
            ['property', 'og:site_name', get_bloginfo('name')],
            ['property', 'og:image', self::$meta['image']],
            ['name', 'twitter:card', self::$meta['image'] === '' ? 'summary' : 'summary_large_image'],
            ['name', 'twitter:title', self::$meta['title']],
            ['name', 'twitter:description', self::$meta['description']],
            ['name', 'twitter:image', self::$meta['image']],
        ];

        foreach ($tags as [$attribute, $key, $value]) {
            if ($value === '' || $value === null) {
                continue;
            }

            if ($key === 'og:url' || str_ends_with($key, 'image')) {
                printf("<meta %s=\"%s\" content=\"%s\" />\n", esc_attr($attribute), esc_attr($key), esc_url($value));
            } else {
                printf("<meta %s=\"%s\" content=\"%s\" />\n", esc_attr($attribute), esc_attr($key), esc_attr($value));
            }
        }

        if (!empty(self::$meta['canonical'])) {
            printf("<link rel=\"canonical\" href=\"%s\" />\n", esc_url(self::$meta['canonical']));
        }
    }

    /**
     * Whether to emit our own social tags and canonical.
     *
     * Always, by default: no SEO plugin can describe a portal route, and a
     * supported one is stood down on it by SeoPluginBridge. A site that keeps
     * its plugin's output with `bit_connect_seo_plugin_stand_down` can silence
     * these instead, so the head does not carry two of each.
     */
    private static function shouldEmitSocialTags(): bool
    {
        return (bool) Hooks::applyFilter('bit_connect_seo_social_tags', true);
    }

    /**
     * The structured-data documents this route emits.
     *
     * Not an administrator setting: no other plugin can describe a portal route,
     * so there is never a competing graph to make way for. A site whose own
     * code has a reason to drop or rewrite a document has
     * `bit_connect_seo_json_ld`, which receives the list — each entry a
     * schema.org document, told apart by its `@type`.
     *
     * @param array<string, mixed> $primary    the page's own description
     * @param array<string, mixed> $breadcrumb its place in the portal
     *
     * @return array<int, array<string, mixed>>
     */
    private static function schemaDocuments(array $primary, array $breadcrumb): array
    {
        $documents = array_values(array_filter([$primary, $breadcrumb]));
        $filtered = Hooks::applyFilter('bit_connect_seo_json_ld', $documents);

        return \is_array($filtered) ? array_values(array_filter($filtered, 'is_array')) : $documents;
    }

    /**
     * Social image for a topic: its featured image, else the community's own.
     *
     * A topic without a thumbnail previously previewed with no image at all,
     * which downgrades the card every platform renders from `summary_large_image`
     * to a bare link.
     *
     * @param array<string, mixed> $topic
     */
    private static function topicImage(array $topic): string
    {
        $postId = (int) ($topic['ID'] ?? 0);

        if ($postId > 0 && has_post_thumbnail($postId)) {
            $url = get_the_post_thumbnail_url($postId, 'full');

            if (\is_string($url) && $url !== '') {
                return $url;
            }
        }

        return self::siteImage();
    }

    /**
     * The community's own image — its configured logo, else the site icon.
     */
    private static function siteImage(): string
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $logo = $generalSettings['logoLight'] ?? '';

        if (\is_string($logo) && $logo !== '') {
            return $logo;
        }

        return (string) get_site_icon_url(512);
    }

    /**
     * Portal → topic trail, so the result shows the community as its parent
     * rather than a bare URL.
     */
    private static function breadcrumbJsonLd(string $title, string $url): array
    {
        if ($title === '') {
            return [];
        }

        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = ($generalSettings['communityTitle'] ?? '') ?: get_bloginfo('name');

        return [
            '@context'        => 'https://schema.org',
            '@type'           => 'BreadcrumbList',
            'itemListElement' => [
                [
                    '@type'    => 'ListItem',
                    'position' => 1,
                    'name'     => $community,
                    'item'     => SeoContent::portalUrl(),
                ],
                [
                    '@type'    => 'ListItem',
                    'position' => 2,
                    'name'     => $title,
                    'item'     => $url,
                ],
            ],
        ];
    }

    /**
     * Meta description for the topic list, seeded with recent topic titles.
     *
     * @param array<int, array<string, mixed>> $topics
     */
    private static function listDescription(array $topics, string $title): string
    {
        $titles = [];

        foreach ($topics as $topic) {
            if (($topic['post_status'] ?? '') === 'publish' && !empty($topic['post_title'])) {
                $titles[] = $topic['post_title'];
            }

            if (\count($titles) === 5) {
                break;
            }
        }

        if (empty($titles)) {
            // translators: %s: community name.
            return \sprintf(__('Discussions and topics from the %s community.', 'bit-connect'), $title);
        }

        // translators: 1: community name, 2: comma-separated list of recent topic titles.
        return \sprintf(__('Recent discussions in %1$s: %2$s', 'bit-connect'), $title, implode(', ', $titles));
    }

    /**
     * Meta description for a term archive that has no description of its own.
     *
     * @param array<int, array<string, mixed>> $topics
     */
    private static function archiveDescription(string $termName, string $community, array $topics): string
    {
        $count = 0;

        foreach ($topics as $topic) {
            if (($topic['post_status'] ?? '') === 'publish') {
                ++$count;
            }
        }

        if ($count === 0) {
            // translators: 1: term name, 2: community name.
            return \sprintf(__('Discussions tagged %1$s in the %2$s community.', 'bit-connect'), $termName, $community);
        }

        return \sprintf(
            // translators: 1: number of discussions, 2: term name, 3: community name.
            _n(
                '%1$s discussion about %2$s in the %3$s community.',
                '%1$s discussions about %2$s in the %3$s community.',
                $count,
                'bit-connect'
            ),
            number_format_i18n($count),
            $termName,
            $community
        );
    }

    /**
     * CollectionPage + ItemList describing the topic list.
     *
     * @param array<int, array<string, mixed>> $topics
     *
     * @return array<string, mixed>
     */
    private static function collectionJsonLd(array $topics, string $title, string $url): array
    {
        $elements = [];
        $position = 1;

        foreach ($topics as $topic) {
            if (($topic['post_status'] ?? '') !== 'publish' || empty($topic['post_title'])) {
                continue;
            }

            $elements[] = [
                '@type'    => 'ListItem',
                'position' => $position++,
                'url'      => SeoContent::portalUrl($topic['post_name'] ?? ''),
                'name'     => $topic['post_title'],
            ];

            if ($position > 20) {
                break;
            }
        }

        return [
            '@context'   => 'https://schema.org',
            '@type'      => 'CollectionPage',
            'name'       => $title,
            'url'        => $url,
            'mainEntity' => [
                '@type'           => 'ItemList',
                'itemListElement' => $elements,
            ],
        ];
    }

    /**
     * Google supports `DiscussionForumPosting` for forum-style content, which is
     * exactly what a topic with replies is.
     *
     * @param array<string, mixed> $topic
     *
     * @return array<string, mixed>
     */
    private static function discussionJsonLd(array $topic, string $url): array
    {
        $data = [
            '@context'      => 'https://schema.org',
            '@type'         => 'DiscussionForumPosting',
            'headline'      => $topic['post_title'] ?? '',
            'url'           => $url,
            'datePublished' => self::iso8601($topic['post_date_gmt'] ?? ''),
            'dateModified'  => self::iso8601($topic['post_modified_gmt'] ?? ''),
            'text'          => SeoContent::excerpt($topic, 120),
            'author'        => [
                '@type' => 'Person',
                'name'  => $topic['author_name'] ?? '',
            ],
            'interactionStatistic' => [
                '@type'                => 'InteractionCounter',
                'interactionType'      => 'https://schema.org/CommentAction',
                'userInteractionCount' => (int) ($topic['comments_count'] ?? 0),
            ],
        ];

        $comments = [];

        foreach ((array) ($topic['comments'] ?? []) as $comment) {
            if (!\is_array($comment) || empty($comment['comment_content'])) {
                continue;
            }

            $comments[] = [
                '@type'         => 'Comment',
                'text'          => wp_strip_all_tags($comment['comment_content']),
                'datePublished' => self::iso8601($comment['comment_date_gmt'] ?? ''),
                'author'        => [
                    '@type' => 'Person',
                    'name'  => $comment['comment_author'] ?? '',
                ],
            ];

            if (\count($comments) === 20) {
                break;
            }
        }

        if (!empty($comments)) {
            $data['comment'] = $comments;
        }

        return array_filter($data, static fn ($value) => $value !== '' && $value !== null);
    }

    private static function iso8601(string $gmtDate): string
    {
        if ($gmtDate === '' || $gmtDate === '0000-00-00 00:00:00') {
            return '';
        }

        $timestamp = strtotime($gmtDate . ' UTC');

        return $timestamp === false ? '' : gmdate('c', $timestamp);
    }
}
