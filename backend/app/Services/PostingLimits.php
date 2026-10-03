<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use InvalidArgumentException;

/**
 * How much a member may put into a topic or a reply.
 *
 * Three things, counted apart: the length of the text, images placed in it,
 * and files attached below it, each per topic and per comment; and the size of
 * one upload. This plugin sets none of them — null is "no limit" — and an
 * upload is held only to what the server accepts. Another plugin may answer
 * `bit_connect_posting_limits` with limits of its own (see ExtensionPoints),
 * and those are enforced here on every write, not only in the portal's
 * editor, which is just one of the ways content reaches the server.
 *
 * For images and files zero means none; text always allows at least one
 * character.
 */
final class PostingLimits
{
    public const CONTEXTS = ['topic', 'comment'];

    public const DEFAULTS = [
        'topic'       => ['attachments' => null, 'characters' => null, 'images' => null],
        'comment'     => ['attachments' => null, 'characters' => null, 'images' => null],
        'maxFileSize' => null,
    ];

    /**
     * Ceiling on a topic's stored HTML, whatever the text limit.
     *
     * The text limit counts what a reader sees; markup comes on top of it, and
     * a limit on the raw HTML would let formatting eat into the words. This is
     * only the backstop against an absurd payload, set well above what the
     * largest text limit an administrator may choose needs.
     */
    public const TOPIC_HTML_CEILING = 200_000;

    /**
     * The limits in force, null where there is none. The file size is always a
     * number: what the server accepts, or less if a listener says so.
     *
     * @return array{topic: array{attachments: null|int, characters: null|int, images: null|int}, comment: array{attachments: null|int, characters: null|int, images: null|int}, maxFileSize: int}
     */
    public static function all(): array
    {
        $offered = ExtensionPoints::postingLimits(self::DEFAULTS);
        $offered = \is_array($offered) ? $offered : [];
        $limits = [];

        foreach (self::CONTEXTS as $context) {
            foreach (self::DEFAULTS[$context] as $kind => $default) {
                $value = $offered[$context][$kind] ?? null;
                $floor = $kind === 'characters' ? 1 : 0;
                $limits[$context][$kind] = is_numeric($value) && (int) $value >= $floor ? (int) $value : $default;
            }
        }

        $size = $offered['maxFileSize'] ?? null;
        $serverMax = (int) wp_max_upload_size();

        $limits['maxFileSize'] = is_numeric($size) && (int) $size > 0
            ? ($serverMax > 0 ? min((int) $size, $serverMax) : (int) $size)
            : $serverMax;

        return $limits;
    }

    public static function maxFileSize(): int
    {
        return self::all()['maxFileSize'];
    }

    /**
     * Refuse content longer, or carrying more media, than its context allows.
     *
     * Either part may be left out — an edit that changes only the status sends
     * no content — and is then not counted.
     *
     * @param string      $context     'topic' or 'comment'
     * @param null|string $content     the HTML being saved
     * @param null|int[]  $attachments the attachment IDs being saved
     *
     * @throws InvalidArgumentException naming the limit that was passed
     */
    public static function assertWithin(string $context, ?string $content, ?array $attachments): void
    {
        $limits = self::all()[$context];

        if ($content !== null && $limits['characters'] !== null && self::countCharacters($content) > $limits['characters']) {
            throw new InvalidArgumentException(esc_html(self::charactersMessage($context, $limits['characters'])));
        }

        if ($content !== null && $limits['images'] !== null && self::countImages($content) > $limits['images']) {
            throw new InvalidArgumentException(esc_html(self::imagesMessage($context, $limits['images'])));
        }

        if ($attachments !== null && $limits['attachments'] !== null && \count($attachments) > $limits['attachments']) {
            throw new InvalidArgumentException(esc_html(self::filesMessage($context, $limits['attachments'])));
        }
    }

    /**
     * The text a reader sees, counted in characters rather than bytes, so a
     * reply in Bangla is held to the same length as one in English.
     */
    public static function countCharacters(string $content): int
    {
        $text = html_entity_decode(wp_strip_all_tags($content), \ENT_QUOTES | \ENT_HTML5, 'UTF-8');

        return mb_strlen(trim($text), 'UTF-8');
    }

    public static function countImages(string $content): int
    {
        return (int) preg_match_all('/<img\b/i', $content);
    }

    private static function charactersMessage(string $context, int $limit): string
    {
        $message = $context === 'topic'
            // translators: %s: the most characters allowed, formatted
            ? __('A topic can be up to %s characters long.', 'bit-connect')
            // translators: %s: the most characters allowed, formatted
            : __('A comment can be up to %s characters long.', 'bit-connect');

        return \sprintf($message, number_format_i18n($limit));
    }

    private static function imagesMessage(string $context, int $limit): string
    {
        $noun = self::noun($context);

        if ($limit === 0) {
            // translators: %s: "a topic" or "a comment"
            return \sprintf(__('Images cannot be added to %s.', 'bit-connect'), $noun);
        }

        // translators: 1: the most images allowed, 2: "a topic" or "a comment"
        return \sprintf(_n('You can add only %1$d image to %2$s.', 'You can add up to %1$d images to %2$s.', $limit, 'bit-connect'), $limit, $noun);
    }

    private static function filesMessage(string $context, int $limit): string
    {
        $noun = self::noun($context);

        if ($limit === 0) {
            // translators: %s: "a topic" or "a comment"
            return \sprintf(__('Files cannot be attached to %s.', 'bit-connect'), $noun);
        }

        // translators: 1: the most files allowed, 2: "a topic" or "a comment"
        return \sprintf(_n('You can attach only %1$d file to %2$s.', 'You can attach up to %1$d files to %2$s.', $limit, 'bit-connect'), $limit, $noun);
    }

    private static function noun(string $context): string
    {
        return $context === 'topic' ? __('a topic', 'bit-connect') : __('a comment', 'bit-connect');
    }
}
