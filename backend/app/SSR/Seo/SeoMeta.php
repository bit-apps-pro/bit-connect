<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Services\PortalTaxonomies;
use WP_Term;

if (!\defined('ABSPATH')) {
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
        $title = $generalSettings['communityTitle'] ?? get_bloginfo('name');
        $page = max(1, $page);
        $url = SeoContent::pageUrl($page);

        // Pages after the first exist to give a crawler a route to topics deeper
        // than the first screenful — they are not themselves worth ranking, and
        // indexing them would put near-identical listings in front of the topic
        // pages they link to. Self-canonical rather than pointing at page 1:
        // noindex on a page whose canonical names a different URL can carry the
        // noindex across to that URL.
        if ($page > 1) {
            self::$meta = [
                'title' => \sprintf(
                    // translators: 1: community name, 2: page number.
                    __('%1$s — page %2$s', 'bit-connect'),
                    $title,
                    number_format_i18n($page)
                ),
                'description' => '',
                'canonical'   => $url,
                'image'       => '',
                'type'        => 'website',
                'robots'      => SeoSettings::bool('indexPagination') ? '' : 'noindex,follow',
                'jsonLd'      => [],
            ];

            return;
        }

        self::$meta = [
            'title'       => $title,
            'description' => self::listDescription($topics, $title),
            // Always the bare portal URL: the list is also served under filter
            // and sort query strings, and every one of those is the same set of
            // topics in a different order. Pointing them all here is what keeps
            // the permutations out of the index.
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

        self::$meta = [
            'title'       => $topic['post_title'] ?? '',
            'description' => SeoContent::excerpt($topic, 30),
            'canonical'   => $url,
            'image'       => self::topicImage($topic),
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
        $community = $generalSettings['communityTitle'] ?? get_bloginfo('name');
        $url = PortalTaxonomies::urlForTerm($term);

        // translators: 1: term name, 2: community name.
        $title = \sprintf(__('%1$s — %2$s', 'bit-connect'), $term->name, $community);

        $description = $term->description !== ''
            ? wp_trim_words(wp_strip_all_tags($term->description), 30, '…')
            : self::archiveDescription($term->name, $community, $topics);

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
                self::breadcrumbJsonLd($term->name, $url)
            ) : [],
        ];
    }

    /**
     * Describe a member profile route.
     *
     * A profile is thin, largely duplicated across members and assembled
     * client-side, so it is deliberately kept out of the index — without this it
     * inherits the portal page's title and canonical and competes with the
     * topics themselves. `follow` is retained so the topics a member links to
     * are still discovered.
     */
    public static function forProfile(string $displayName = ''): void
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $community = $generalSettings['communityTitle'] ?? get_bloginfo('name');

        $title = $displayName === ''
            // translators: %s: community name.
            ? \sprintf(__('Member profile — %s', 'bit-connect'), $community)
            // translators: 1: member display name, 2: community name.
            : \sprintf(__('%1$s — %2$s', 'bit-connect'), $displayName, $community);

        self::$meta = [
            'title'       => $title,
            'description' => '',
            'canonical'   => '',
            'image'       => '',
            'type'        => 'profile',
            'robots'      => SeoSettings::bool('indexProfiles') ? '' : 'noindex,follow',
            'jsonLd'      => [],
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
        $community = $generalSettings['communityTitle'] ?? get_bloginfo('name');

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
     * Resolved head data for the matched route, or null when none matched.
     *
     * Read by SeoPluginBridge, which feeds the same values into whichever SEO
     * plugin owns the head on this site.
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

        // Every value is escaped as it is assembled in head().
        echo self::head(); // phpcs:ignore Generic.PHP.ForbiddenFunctions.FoundWithAlternative, WordPress.Security.EscapeOutput.OutputNotEscaped
    }

    /**
     * Head markup for the matched route, or an empty string when none matched.
     *
     * Split from render() so the output can be asserted without capturing echo.
     */
    public static function head(): string
    {
        if (self::$meta === null) {
            return '';
        }

        // First-paint styles for the server-rendered body markup. Emitted here
        // because a <style> element is only conforming HTML in the head, and
        // this hook fires on exactly the requests that render that markup.
        $html = SeoContent::criticalCss() . "\n";

        // Running before first paint, this flips the body markup from the
        // crawler view (content) to the human view (loading spinner) — see the
        // .bc-js rules in the critical CSS. The timeout is a safety valve: if
        // the app bundle never mounts, the content is re-revealed rather than
        // leaving the visitor on an endless spinner. Once React mounts, the
        // .bc-ssr subtree no longer exists and removing the class is a no-op.
        $html .= <<<'HTML'
<script>document.documentElement.classList.add("bc-js");setTimeout(function(){document.documentElement.classList.remove("bc-js")},8000)</script>

HTML;

        // Robots directives are never delegated: a route we mark noindex must
        // stay out of the index whether or not an SEO plugin is installed, and
        // SeoPluginBridge suppresses the plugin's competing tag when it runs.
        if (!empty(self::$meta['robots'])) {
            $html .= '<meta name="robots" content="' . esc_attr(self::$meta['robots']) . '" />' . "\n";
        }

        // JSON-LD is additive — no SEO plugin emits a competing
        // DiscussionForumPosting or portal BreadcrumbList for these routes, so
        // it is always safe.
        foreach ((array) (self::$meta['jsonLd'] ?? []) as $document) {
            if (empty($document)) {
                continue;
            }

            // JSON_HEX_TAG is load-bearing, not cosmetic: topic titles and reply
            // bodies land inside a <script> block, so a post titled
            // `</script><img src=x onerror=…>` would otherwise close the tag and
            // execute. Hex-encoding < and > makes a break-out impossible.
            $json = wp_json_encode(
                $document,
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            );
            $html .= '<script type="application/ld+json">' . $json . '</script>' . "\n";
        }

        if (!self::shouldEmitSocialTags()) {
            return $html;
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

            $content = $key === 'og:url' || str_ends_with($key, 'image')
                ? esc_url($value)
                : esc_attr($value);

            $name = esc_attr($attribute);
            $property = esc_attr($key);
            $html .= '<meta ' . $name . '="' . $property . '" content="' . $content . '" />' . "\n";
        }

        if (!empty(self::$meta['canonical'])) {
            $canonical = esc_url(self::$meta['canonical']);
            $html .= '<link rel="canonical" href="' . $canonical . '" />' . "\n";
        }

        return $html;
    }

    /**
     * Whether to emit our own social tags and canonical.
     *
     * Two sets of `og:title` is worse than one, so only one component may own
     * these. When a supported SEO plugin is active, SeoPluginBridge pushes this
     * same route data through that plugin's own filters and it prints them —
     * so emitting here as well would duplicate every tag. With no such plugin,
     * nothing else describes the route and we print them ourselves.
     */
    private static function shouldEmitSocialTags(): bool
    {
        return (bool) Hooks::applyFilter('bit_connect_seo_social_tags', !SeoPluginBridge::isBridged());
    }

    /**
     * The structured-data documents this route may emit, after the settings.
     *
     * Both kinds are additive and safe by default, so they are on unless an
     * administrator has a reason to silence them — most often another plugin
     * already describing the same page and two competing graphs being worse
     * than one.
     *
     * @param array<string, mixed> $primary    the page's own description
     * @param array<string, mixed> $breadcrumb its place in the portal
     *
     * @return array<int, array<string, mixed>>
     */
    private static function schemaDocuments(array $primary, array $breadcrumb): array
    {
        $documents = [];

        if (!empty($primary) && SeoSettings::bool('schemaDiscussion')) {
            $documents[] = $primary;
        }

        if (!empty($breadcrumb) && SeoSettings::bool('schemaBreadcrumbs')) {
            $documents[] = $breadcrumb;
        }

        return $documents;
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
        $community = $generalSettings['communityTitle'] ?? get_bloginfo('name');

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
