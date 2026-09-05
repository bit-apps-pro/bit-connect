<?php

namespace BitApps\BitConnect\SSR\Seo;

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Enum\GeneralSettings;
use BitApps\BitConnect\Enum\SeoSettings;
use BitApps\BitConnect\Services\PortalLocation;
use BitApps\BitConnect\Services\PortalTaxonomies;
use WP_Term;

if (!\defined('ABSPATH')) {
    exit;
}

/**
 * Renders the portal's per-request data as plain, semantic HTML.
 *
 * The React app replaces this markup the moment it mounts, so it exists for the
 * clients that never run it: non-JS crawlers, AI/LLM fetchers and link preview
 * bots. Every visitor — bot or human — receives the same markup built from the
 * same query under the same visibility rules, so this is progressive
 * enhancement rather than cloaking.
 *
 * The data comes from the query the route controller already ran for the
 * interactivity state, so rendering it costs no extra database work.
 */
final class SeoContent
{
    /**
     * Whether the portal's content may be exposed to unauthenticated clients.
     *
     * A portal restricted to logged-in members must not hand its topics to a
     * crawler, so no server-rendered content is produced at all in that mode.
     */
    public static function isEnabled(): bool
    {
        // A members-only portal always wins: the setting can switch rendering
        // off, never on for content the portal itself refuses to show.
        $enabled = self::isPortalPublic() && SeoSettings::bool('serverRendering');

        return (bool) Hooks::applyFilter('bit_connect_seo_content_enabled', $enabled);
    }

    /**
     * Whether the portal's content is visible to logged-out visitors at all.
     *
     * Deliberately separate from isEnabled(): a site can switch off the plain
     * HTML fallback and still want a sitemap, because Googlebot renders
     * JavaScript and reaches these URLs perfectly well without it. Only the
     * clients that never run the bundle — most AI crawlers and every link
     * preview bot — depend on the rendered markup.
     */
    public static function isPortalPublic(): bool
    {
        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);

        return ($generalSettings['portalAccess'] ?? 'everyone') === 'everyone';
    }

    /**
     * The topic list route (`/`).
     *
     * @param array<int, array<string, mixed>> $topics
     */
    public static function forTopics(array $topics, int $page = 1, int $totalPages = 1): string
    {
        if (empty($topics) || !self::isEnabled()) {
            return '';
        }

        $generalSettings = Config::getOption(GeneralSettings::OPTION_NAME->value, []);
        $communityTitle = $generalSettings['communityTitle'] ?? get_bloginfo('name');

        $items = '';

        foreach ($topics as $topic) {
            if (!self::isPublic($topic)) {
                continue;
            }

            $items .= self::topicSummary($topic);
        }

        if ($items === '') {
            return '';
        }

        $heading = esc_html($communityTitle);
        $trail = self::pageTrail($page, $totalPages);

        return <<<HTML
<div class="bc-ssr bc-p-3 lg:bc-p-4">
<h1 class="bc-mb-4 bc-text-xl bc-font-semibold">{$heading}</h1>
<ul class="bc-m-0 bc-flex bc-list-none bc-flex-col bc-gap-3 bc-p-0">{$items}</ul>
{$trail}
</div>
HTML;
    }

    /**
     * A term archive route (`/{segment}/{term}`).
     *
     * Carries its own heading and description rather than reusing the list
     * markup: the heading is what tells a crawler this page is *about* the term,
     * and it is the difference between a cluster hub and another copy of the
     * topic list.
     *
     * @param array<int, array<string, mixed>> $topics
     */
    public static function forArchive(WP_Term $term, array $topics): string
    {
        if (!self::isEnabled()) {
            return '';
        }

        $items = '';

        foreach ($topics as $topic) {
            if (!self::isPublic($topic)) {
                continue;
            }

            $items .= self::topicSummary($topic);
        }

        $heading = esc_html($term->name);
        $backUrl = esc_url(self::portalUrl());
        $backLabel = esc_html__('Back to all topics', 'bit-connect');

        $intro = $term->description === ''
            ? ''
            : '<p class="bc-mb-4 bc-text-gray-600">' . esc_html(wp_strip_all_tags($term->description)) . '</p>';

        // An archive with no topics is still a real page — the term exists and
        // may fill up later — so it renders its heading rather than collapsing
        // to nothing the way an empty topic list does.
        $list = $items === ''
            ? '<p class="bc-text-gray-500">' . esc_html__('No topics here yet.', 'bit-connect') . '</p>'
            : '<ul class="bc-m-0 bc-flex bc-list-none bc-flex-col bc-gap-3 bc-p-0">' . $items . '</ul>';

        return <<<HTML
<div class="bc-ssr bc-p-3 lg:bc-p-4">
<h1 class="bc-mb-4 bc-text-xl bc-font-semibold">{$heading}</h1>
{$intro}
{$list}
<p class="bc-mt-4"><a href="{$backUrl}">{$backLabel}</a></p>
</div>
HTML;
    }

    /**
     * The topic detail route (`/{slug}`).
     *
     * @param null|array<string, mixed> $topic
     */
    public static function forTopic(?array $topic): string
    {
        if (empty($topic) || empty($topic['post_title']) || !self::isPublic($topic) || !self::isEnabled()) {
            return '';
        }

        $body = isset($topic['post_content']) && $topic['post_content'] !== ''
            ? wp_kses_post(wpautop($topic['post_content']))
            : '';

        $title = esc_html($topic['post_title']);
        $byline = self::byline($topic);
        $terms = self::terms($topic);
        $replies = self::comments($topic);
        $backUrl = esc_url(self::portalUrl());
        $backLabel = esc_html__('Back to all topics', 'bit-connect');

        return <<<HTML
<div class="bc-ssr bc-p-3 lg:bc-p-4">
<article class="bc-rounded-lg bc-border bc-border-solid bc-border-gray-200 bc-p-3 lg:bc-p-4">
<h1 class="bc-mb-2 bc-text-xl bc-font-semibold bc-leading-snug">{$title}</h1>
{$byline}
<div class="bc-mt-3 bc-text-gray-700">{$body}</div>
{$terms}
{$replies}
</article>
<p class="bc-mt-4"><a href="{$backUrl}">{$backLabel}</a></p>
</div>
HTML;
    }

    /**
     * Absolute URL of a portal route.
     *
     * Built from the portal's configured placement rather than `get_permalink()`
     * — the post type's own rewrite (`/bit-connect/{slug}`) is a different URL
     * from the portal route the React router serves.
     */
    public static function portalUrl(string $path = ''): string
    {
        return PortalLocation::url($path);
    }

    /**
     * Absolute URL of a deeper page of the list.
     *
     * Run through user_trailingslashit() so it takes the site's own permalink
     * form. WordPress's redirect_canonical enforces that form on `/page/N`, so
     * without this both the canonical and every crawl link would name a URL that
     * answers with a 301 rather than the page itself.
     */
    public static function pageUrl(int $page): string
    {
        if ($page <= 1) {
            return self::portalUrl();
        }

        return user_trailingslashit(self::portalUrl('page/' . $page), 'paged');
    }

    /**
     * Plain-text summary of a topic, for meta descriptions and list excerpts.
     *
     * @param array<string, mixed> $topic
     */
    public static function excerpt(array $topic, int $words = 40): string
    {
        $source = !empty($topic['post_excerpt'])
            ? $topic['post_excerpt']
            : ($topic['post_content'] ?? '');

        if ($source === '') {
            return '';
        }

        return wp_trim_words(wp_strip_all_tags(strip_shortcodes($source)), $words, '…');
    }

    /**
     * Minimal inline styles for the pre-mount first paint.
     *
     * In dev every stylesheet arrives through the JS bundle, and even the
     * production CSS can lag the HTML — so without this the server markup
     * renders completely unstyled until React mounts. ~1 KB, scoped under
     * `.bc-ssr`, values matched to the Tailwind theme.
     *
     * Printed from SeoMeta's wp_head hook rather than inline with the body
     * markup — a `<style>` inside a `<div>` is non-conforming HTML, and the
     * head fires on exactly the requests that render this content. After React
     * mounts, no `.bc-ssr` element exists, so the rules match nothing.
     */
    public static function criticalCss(): string
    {
        return <<<'HTML'
<style>
.bc-ssr{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:960px;margin:0 auto;padding:1rem;color:#374151;line-height:1.5}
.bc-ssr h1{font-size:1.25rem;font-weight:600;margin:0 0 1rem}
.bc-ssr ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.75rem}
.bc-ssr li,.bc-ssr>article{border:1px solid #e5e7eb;border-radius:.5625rem;padding:.75rem}
.bc-ssr h2{font-size:1rem;font-weight:600;margin:0;line-height:1.375}
.bc-ssr a{color:#3266EA;text-decoration:none}
.bc-ssr p{margin:.25rem 0 0}
.bc-ssr li p{font-size:.875rem}
.bc-ssr time,.bc-ssr li p:last-child,.bc-ssr>article>p:first-of-type{color:#6b7280;font-size:.8125rem}
.bc-ssr section h2{margin-bottom:.5rem}
.bc-ssr-loading{display:none}
.bc-js .bc-ssr-loading{display:block}
.bc-js .bc-ssr{display:none}
</style>
HTML;
    }

    /**
     * Previous/next links for the list route.
     *
     * The server list is capped at a screenful, so without these a crawler can
     * reach only the newest topics by following links — everything older is
     * discoverable through the sitemap alone, with no path carrying it any
     * internal link weight. The React app replaces this markup on mount, so
     * these pages are a crawl path rather than a UI.
     */
    private static function pageTrail(int $page, int $totalPages): string
    {
        if ($totalPages <= 1) {
            return '';
        }

        $links = [];

        if ($page > 1) {
            $href = esc_url(self::pageUrl($page - 1));
            $links[] = '<a href="' . $href . '" rel="prev">' . esc_html__('Newer topics', 'bit-connect') . '</a>';
        }

        if ($page < $totalPages) {
            $href = esc_url(self::pageUrl($page + 1));
            $links[] = '<a href="' . $href . '" rel="next">' . esc_html__('Older topics', 'bit-connect') . '</a>';
        }

        if (empty($links)) {
            return '';
        }

        return '<nav class="bc-mt-4 bc-flex bc-gap-4">' . implode(' ', $links) . '</nav>';
    }

    /**
     * Whether a topic is safe to put in front of an anonymous crawler.
     *
     * `TopicService::getTopicBySlug()` resolves by slug via `get_page_by_path()`,
     * which does not constrain post status — a draft or pending topic can come
     * back. `getAllTopics()` also widens the status list to include `private`
     * for any logged-in visitor. Neither should ever reach the indexable markup,
     * so publish status is re-checked here rather than trusted upstream.
     *
     * @param array<string, mixed> $topic
     */
    private static function isPublic(array $topic): bool
    {
        return ($topic['post_status'] ?? '') === 'publish';
    }

    /**
     * One topic rendered as a card in the list.
     *
     * @param array<string, mixed> $topic
     */
    private static function topicSummary(array $topic): string
    {
        if (empty($topic['post_title'])) {
            return '';
        }

        $url = self::portalUrl($topic['post_name'] ?? '');
        $excerpt = self::excerpt($topic);

        $href = esc_url($url);
        $title = esc_html($topic['post_title']);
        $summary = $excerpt === ''
            ? ''
            : '<p class="bc-mt-1 bc-text-gray-600">' . esc_html($excerpt) . '</p>';
        $byline = self::byline($topic);

        // Mirrors components/utilities/topic-card/topic-card.tsx so the first
        // paint matches the card React renders a moment later.
        return <<<HTML
<li class="topic-card bc-flex bc-max-w-full bc-gap-3 bc-overflow-hidden bc-rounded-lg bc-border bc-border-solid bc-border-gray-200 bc-p-3 lg:bc-gap-4">
<article class="bc-flex bc-min-w-0 bc-max-w-full bc-flex-1 bc-flex-col">
<h2 class="bc-mb-0 bc-min-w-0 bc-text-[16px] bc-font-semibold bc-leading-snug"><a href="{$href}">{$title}</a></h2>
{$summary}
{$byline}
</article>
</li>
HTML;
    }

    /**
     * Author, date and reply count line shared by the list and detail views.
     *
     * @param array<string, mixed> $topic
     */
    private static function byline(array $topic): string
    {
        $parts = [];

        if (!empty($topic['author_name'])) {
            $parts[] = '<span class="bc-truncate bc-text-gray-700">' . esc_html($topic['author_name']) . '</span>';
        }

        if (!empty($topic['post_date_gmt'])) {
            $parts[] = '<time datetime="' . esc_attr(gmdate('c', strtotime($topic['post_date_gmt'] . ' UTC'))) . '">'
                . esc_html(date_i18n(get_option('date_format'), strtotime($topic['post_date'] ?? $topic['post_date_gmt'])))
                . '</time>';
        }

        if (isset($topic['comments_count'])) {
            $count = (int) $topic['comments_count'];
            $parts[] = '<span class="bc-whitespace-nowrap">'
                // translators: %s: number of replies on a topic.
                . esc_html(\sprintf(_n('%s reply', '%s replies', $count, 'bit-connect'), number_format_i18n($count)))
                . '</span>';
        }

        if (empty($parts)) {
            return '';
        }

        $meta = implode(' <span class="bc-text-gray-300">•</span> ', $parts);

        return '<p class="bc-mt-3 bc-flex bc-items-center bc-gap-2 bc-text-sm bc-text-gray-500">' . $meta . '</p>';
    }

    /**
     * Taxonomy terms attached to a topic, as a plain comma-separated line.
     *
     * @param array<string, mixed> $topic
     */
    private static function terms(array $topic): string
    {
        if (empty($topic['terms']) || !\is_array($topic['terms'])) {
            return '';
        }

        $links = [];

        foreach ($topic['terms'] as $group) {
            if (!\is_array($group)) {
                continue;
            }

            // A single-term taxonomy arrives as one term array, a multi-term one
            // as a list of them. Normalising here is also what fixes single-term
            // taxonomies never rendering at all: iterating the associative array
            // directly walked its scalar values, and every one was skipped for
            // not being an array.
            $terms = isset($group['name']) ? [$group] : $group;

            foreach ($terms as $term) {
                if (!\is_array($term) || empty($term['name'])) {
                    continue;
                }

                $links[] = self::termLink($term);
            }
        }

        if (empty($links)) {
            return '';
        }

        return '<p class="bc-mt-3 bc-text-sm bc-text-gray-500">' . implode(', ', $links) . '</p>';
    }

    /**
     * A term as a link to its archive, or plain text when it has none.
     *
     * These links are what connect a topic to its cluster hub — without them a
     * crawler reaching a deep topic has no route to the rest of the subject, and
     * the archives are discoverable only through the sitemap.
     *
     * @param array<string, mixed> $term
     */
    private static function termLink(array $term): string
    {
        $name = esc_html($term['name']);

        $segment = empty($term['taxonomy'])
            ? ''
            : PortalTaxonomies::segmentFor((string) $term['taxonomy']);

        if ($segment === '' || empty($term['slug'])) {
            return $name;
        }

        $url = esc_url(PortalTaxonomies::url($segment, (string) $term['slug']));

        return '<a href="' . $url . '">' . $name . '</a>';
    }

    /**
     * Approved replies on a topic, so the discussion itself is indexable.
     *
     * @param array<string, mixed> $topic
     */
    private static function comments(array $topic): string
    {
        if (empty($topic['comments']) || !\is_array($topic['comments'])) {
            return '';
        }

        $items = '';

        foreach ($topic['comments'] as $comment) {
            if (!\is_array($comment) || empty($comment['comment_content'])) {
                continue;
            }

            $author = $comment['author_name'] ?? ($comment['comment_author'] ?? '');
            $name = $author === ''
                ? ''
                : '<p class="bc-mb-1 bc-text-sm bc-font-semibold bc-text-gray-700">' . esc_html($author) . '</p>';
            $body = wp_kses_post(wpautop($comment['comment_content']));

            $items .= <<<HTML
<li class="bc-rounded-lg bc-border bc-border-solid bc-border-gray-200 bc-p-3">
{$name}
<div class="bc-text-gray-700">{$body}</div>
</li>
HTML;
        }

        if ($items === '') {
            return '';
        }

        $heading = esc_html__('Replies', 'bit-connect');

        return <<<HTML
<section class="bc-mt-4">
<h2 class="bc-mb-2 bc-text-base bc-font-semibold">{$heading}</h2>
<ul class="bc-m-0 bc-flex bc-list-none bc-flex-col bc-gap-2 bc-p-0">{$items}</ul>
</section>
HTML;
    }
}
