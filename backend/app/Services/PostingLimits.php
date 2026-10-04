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
 * Counted apart, per topic and per comment: the length of the text, images
 * placed in it, videos attached to it and the other files attached to it; and
 * the size of one upload, which may differ by kind of file. This plugin sets
 * none of them — null is "no limit" — and an upload is held only to what the
 * server accepts. Another plugin may answer `bit_connect_posting_limits` with
 * limits of its own (see ExtensionPoints), and those are enforced here on every
 * write, not only in the portal's editor, which is just one of the ways content
 * reaches the server.
 *
 * For images, videos and files zero means none; text always allows at least
 * one character.
 */
final class PostingLimits
{
    public const CONTEXTS = ['topic', 'comment'];

    /**
     * The kinds of file an upload's size may be held to separately: an image,
     * a video, or anything else, which is a document.
     */
    public const FILE_KINDS = ['image', 'video', 'document'];

    public const DEFAULTS = [
        'topic'             => ['attachments' => null, 'characters' => null, 'images' => null, 'videos' => null],
        'comment'           => ['attachments' => null, 'characters' => null, 'images' => null, 'videos' => null],
        'maxFileSize'       => null,
        'maxFileSizeByKind' => ['image' => null, 'video' => null, 'document' => null],
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
     * The limits in force, null where there is none. The file sizes are always
     * numbers: what the server accepts, or less if a listener says so. A kind
     * of file a listener sets no size for takes the general one.
     *
     * @return array{topic: array{attachments: null|int, characters: null|int, images: null|int, videos: null|int}, comment: array{attachments: null|int, characters: null|int, images: null|int, videos: null|int}, maxFileSize: int, maxFileSizeByKind: array{image: int, video: int, document: int}}
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

        $serverMax = (int) wp_max_upload_size();
        $limits['maxFileSize'] = self::capSize($offered['maxFileSize'] ?? null, $serverMax) ?? $serverMax;

        foreach (self::FILE_KINDS as $kind) {
            $limits['maxFileSizeByKind'][$kind] = self::capSize($offered['maxFileSizeByKind'][$kind] ?? null, $serverMax)
                ?? $limits['maxFileSize'];
        }

        return $limits;
    }

    /**
     * The largest file of any kind an upload may be — the ceiling checked
     * before the file's kind is known.
     */
    public static function maxFileSize(): int
    {
        return max(self::all()['maxFileSizeByKind']);
    }

    /**
     * How large a file whose content reads as this MIME type may be.
     */
    public static function maxFileSizeFor(string $mime): int
    {
        return self::all()['maxFileSizeByKind'][self::kindOf($mime)];
    }

    /**
     * Which kind of file a MIME type is, for its size limit and its count.
     */
    public static function kindOf(string $mime): string
    {
        $family = strtok(strtolower($mime), '/');

        return \in_array($family, ['image', 'video'], true) ? $family : 'document';
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

        if ($attachments === null) {
            return;
        }

        // A video is counted against the videos limit and every other file
        // against the files limit, so allowing a few videos does not quietly
        // mean allowing as many videos as files.
        $videos = \count(array_filter($attachments, fn ($id) => self::isVideo((int) $id)));
        $files = \count($attachments) - $videos;

        if ($limits['videos'] !== null && $videos > $limits['videos']) {
            throw new InvalidArgumentException(esc_html(self::videosMessage($context, $limits['videos'])));
        }

        if ($limits['attachments'] !== null && $files > $limits['attachments']) {
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

    /**
     * A listener's size, held to what the server accepts; null for none given.
     *
     * @param mixed $size
     */
    private static function capSize($size, int $serverMax): ?int
    {
        if (!is_numeric($size) || (int) $size <= 0) {
            return null;
        }

        return $serverMax > 0 ? min((int) $size, $serverMax) : (int) $size;
    }

    private static function isVideo(int $attachmentId): bool
    {
        $mime = get_post_mime_type($attachmentId);

        return \is_string($mime) && self::kindOf($mime) === 'video';
    }

    private static function videosMessage(string $context, int $limit): string
    {
        $noun = self::noun($context);

        if ($limit === 0) {
            // translators: %s: "a topic" or "a comment"
            return \sprintf(__('Videos cannot be added to %s.', 'bit-connect'), $noun);
        }

        // translators: 1: the most videos allowed, 2: "a topic" or "a comment"
        return \sprintf(_n('You can add only %1$d video to %2$s.', 'You can add up to %1$d videos to %2$s.', $limit, 'bit-connect'), $limit, $noun);
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
