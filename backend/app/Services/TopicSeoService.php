<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * How one topic asks to appear in search results and link previews.
 *
 * By default a topic's search title is its own title and its description is
 * the first lines of the question. When those lines are vague the Google
 * result is vague, and until now nobody could override it. These three fields
 * — title, description, image — sit on the topic itself and win over the
 * derived values wherever SeoMeta describes the topic, including through
 * whichever SEO plugin owns the head.
 *
 * They are presentation, not content: the words of a topic belong to its
 * author alone, but how the site presents that topic to a search engine is a
 * site-level concern, so a manager may correct them as well.
 */
final class TopicSeoService
{
    public const META_KEY = '_bit_connect_seo';

    /**
     * Google shows around 60 characters of a title and 160 of a description.
     * The caps are looser than that: a longer value is truncated in the result,
     * not rejected, and the form tells the author where the cut falls.
     */
    public const TITLE_MAX = 200;

    public const DESCRIPTION_MAX = 320;

    public const IMAGE_MAX = 2000;

    /**
     * The shape every reader gets, including a topic that has never set any.
     *
     * @return array{title: string, description: string, image: string}
     */
    public static function blank(): array
    {
        return ['title' => '', 'description' => '', 'image' => ''];
    }

    /**
     * The fields a topic has set, blank where it has not.
     *
     * Always merged over the blank shape: a record written before a field
     * existed still answers with every key, so no reader has to null-check.
     *
     * @return array{title: string, description: string, image: string}
     */
    public static function forPost(int $postId): array
    {
        if ($postId <= 0) {
            return self::blank();
        }

        $stored = get_post_meta($postId, self::META_KEY, true);

        return self::sanitize(\is_array($stored) ? $stored : []);
    }

    /**
     * Whether a topic has customised any of its search appearance.
     *
     * @param array<string, mixed> $seo
     */
    public static function isSet(array $seo): bool
    {
        foreach (self::sanitize($seo) as $value) {
            if ($value !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * Store the fields, or drop the record when every one is blank.
     *
     * Blank means "back to the derived values", and a topic that has gone back
     * should be indistinguishable from one that never left — so nothing is kept
     * for it rather than an empty record.
     *
     * @param array<string, mixed> $seo
     */
    public static function save(int $postId, array $seo): void
    {
        if ($postId <= 0) {
            return;
        }

        $clean = self::sanitize($seo);

        if (!self::isSet($clean)) {
            delete_post_meta($postId, self::META_KEY);

            return;
        }

        update_post_meta($postId, self::META_KEY, $clean);
    }

    /**
     * Every field as plain text within its cap; the image as an http(s) URL or
     * nothing.
     *
     * Applied on write and on read alike. The write side is the real gate; the
     * read side makes a record that predates a rule — or was written by hand —
     * harmless, since every value here lands in the document head.
     *
     * @param array<string, mixed> $input
     *
     * @return array{title: string, description: string, image: string}
     */
    public static function sanitize(array $input): array
    {
        return [
            'title'       => self::text($input['title'] ?? '', self::TITLE_MAX),
            'description' => self::text($input['description'] ?? '', self::DESCRIPTION_MAX),
            'image'       => self::imageUrl($input['image'] ?? ''),
        ];
    }

    /**
     * @param mixed $value
     */
    private static function text($value, int $max): string
    {
        if (!\is_scalar($value)) {
            return '';
        }

        // A description is one paragraph of a search snippet; line breaks in it
        // are noise, so it goes through the single-line sanitiser like the title.
        $text = sanitize_text_field((string) $value);
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);

        if (mb_strlen($text) > $max) {
            $text = rtrim(mb_substr($text, 0, $max));
        }

        return $text;
    }

    /**
     * @param mixed $value
     */
    private static function imageUrl($value): string
    {
        if (!\is_string($value)) {
            return '';
        }

        $url = trim($value);

        if ($url === '' || mb_strlen($url) > self::IMAGE_MAX) {
            return '';
        }

        // Only a web URL can be an og:image. esc_url_raw() already refuses other
        // schemes, and a scheme-relative or bare path is refused here as well:
        // a preview bot fetching the image has no page to resolve it against.
        $url = esc_url_raw($url, ['http', 'https']);

        if ($url === '' || !\in_array(strtolower((string) wp_parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)) {
            return '';
        }

        return $url;
    }
}
