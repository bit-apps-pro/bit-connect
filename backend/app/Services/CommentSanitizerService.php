<?php

namespace BitApps\BitConnect\Services;

use InvalidArgumentException;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * CommentSanitizerService — backend authority for comment HTML sanitization.
 *
 * Comments have tighter constraints than post content:
 *
 *  - WordPress's comment_text filter applies wpautop, convert_smilies, and
 *    convert_chars — the HTML must be paragraph-based.
 *  - WordPress core's default allowed comment tags are very minimal (a, b, em,
 *    strong, code, blockquote, etc.). We use a slightly extended but still
 *    conservative whitelist that matches what Quill's snow theme can produce.
 *  - No Gutenberg block classes — comments are not blocks.
 *  - No headings, tables, or images in the default flow.
 *  - The MySQL comment_content column is TEXT = 65,535 bytes.
 *  - Links in comments get rel="nofollow ugc" to match WordPress convention.
 *
 * Pipeline:
 *   raw input
 *     → wp_check_invalid_utf8()
 *     → null-byte strip
 *     → wp_kses() with comment whitelist
 *     → size check (post-sanitization)
 *     → URL validation
 *     → wpautop-compatibility normalisation
 */
final class CommentSanitizerService
{
    /**
     * MySQL TEXT column limit for wp_comments.comment_content.
     * Checked post-sanitization to prevent padding exploits.
     */
    private const MAX_HTML_BYTES = 65_000;

    /**
     * Human-readable plain-text limit shown in validation errors.
     * Mirrors COMMENT_LIMITS.MAX_TEXT_CHARS in quill-comment-formatter.ts.
     */
    private const MAX_TEXT_CHARS = 5_000;

    /**
     * The only classes a comment may carry, on any element.
     *
     * An allowlist rather than a blocklist, because `class` had to be admitted
     * at all for exactly one thing: the editor marks a mention with
     * MentionService::MARKUP_CLASS, and a mention that renders as an ordinary
     * blue link is not a mention any reader can see. Admitting `class` without
     * this hands every commenter the portal's whole stylesheet — enough to draw
     * a convincing fake button, or to hide text inside their own comment.
     */
    private const ALLOWED_CLASSES = [MentionService::MARKUP_CLASS];

    /**
     * Sanitize raw comment HTML from the Quill editor.
     *
     * @param string $html raw HTML from the request payload
     *
     * @throws InvalidArgumentException when content fails hard validation rules
     *
     * @return string sanitized HTML safe for wp_insert_comment / wp_update_comment
     */
    public function sanitize(string $html): string
    {
        // 1. Reject malformed UTF-8 — invalid sequences can bypass regex sanitizers.
        $checked = wp_check_invalid_utf8($html);
        if ($checked === '') {
            throw new InvalidArgumentException('Comment contains invalid character encoding.');
        }

        // 2. Strip null bytes.
        $html = str_replace("\0", '', $html);

        // 3. Sanitize with our comment-specific whitelist.
        $sanitized = wp_kses($html, $this->getAllowedHtml());

        // 4. Enforce byte limit on *sanitized* output.
        if (\strlen($sanitized) > self::MAX_HTML_BYTES) {
            throw new InvalidArgumentException(\sprintf('Comment exceeds maximum allowed length of %d bytes.', self::MAX_HTML_BYTES));
        }

        // 5. Enforce plain-text character limit (prevents giant wall-of-text spam).
        $plainText = wp_strip_all_tags($sanitized);
        if (mb_strlen($plainText) > self::MAX_TEXT_CHARS) {
            throw new InvalidArgumentException(\sprintf('Comment exceeds %d characters. Please shorten it.', self::MAX_TEXT_CHARS));
        }

        // 6. Validate and normalise URLs in href attributes.
        $sanitized = $this->sanitizeUrls($sanitized);

        // 7. Normalise for wpautop compatibility.
        return $this->normalize($sanitized);
    }

    /**
     * Return the wp_kses allowed-HTML whitelist for comments.
     *
     * Matches what quill-comment-formatter.ts produces and extends
     * WordPress core's $allowedtags global with pre/code for code blocks.
     *
     * Deliberately excludes: headings, tables, iframes, script,
     * embed, object, form, input, style, and all event attributes.
     */
    public function getAllowedHtml(): array
    {
        return [
            // ---- Paragraphs & breaks ---------------------------------------
            'p'  => [],
            'br' => [],

            // ---- Inline formatting -----------------------------------------
            'strong' => [],
            'b'      => [],
            'em'     => [],
            'i'      => [],
            'u'      => [],
            's'      => [],
            'del'    => ['datetime' => true],
            'q'      => ['cite' => true],
            'cite'   => [],
            'abbr'   => ['title' => true],
            'code'   => [],
            'sub'    => [],
            'sup'    => [],

            // ---- Links -----------------------------------------------------
            // Only href and title — rel is set programmatically in sanitizeUrls()
            //
            // `class` is admitted for one value and one only: the mention marker
            // (see normalize(), which throws every other class away). Without it
            // a mention in a comment would be stripped back to an ordinary blue
            // link, while the same mention in a topic — post content, where
            // wp_kses_post keeps classes — kept its styling.
            'a' => [
                'href'  => true,
                'title' => true,
                'rel'   => true,
                'class' => true,
            ],

            // ---- Blockquotes -----------------------------------------------
            'blockquote' => ['cite' => true],

            // ---- Code blocks -----------------------------------------------
            // <pre><code> is the only multi-line code pattern we allow
            'pre' => [],

            // ---- Lists -----------------------------------------------------
            'ul' => [],
            'ol' => ['start' => true, 'type' => true],
            'li' => [],

            // ---- Images ----------------------------------------------------
            'img' => [
                'src'    => true,
                'alt'    => true,
                'width'  => true,
                'height' => true,
            ],
        ];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Validate every href attribute and enforce WordPress comment link convention.
     *
     * - Strips javascript:, data:, and vbscript: URIs (esc_url_raw returns '').
     * - Adds rel="nofollow ugc" to all external links (WordPress standard).
     * - Removes rel/target from internal/relative links.
     */
    private function sanitizeUrls(string $html): string
    {
        // Validate href values
        $html = preg_replace_callback(
            '/\shref=(["\'])([^"\']*)\1/i',
            static function (array $m): string {
                $quote = $m[1];
                $clean = esc_url_raw($m[2]);

                // esc_url_raw returns '' for dangerous schemes
                if ($clean === '') {
                    return '';
                }

                return " href={$quote}{$clean}{$quote}";
            },
            $html
        ) ?? $html;

        // Add rel="nofollow ugc" to external links that don't already have it.
        // This matches what WordPress core does via the_content filter for comments.
        $html = preg_replace_callback(
            '/<a\s([^>]*)>/i',
            static function (array $m): string {
                $attrs = $m[1];
                preg_match('/href=(["\'])([^"\']*)\1/i', $attrs, $hrefMatch);
                $href = $hrefMatch[2] ?? '';

                $isExternal = $href !== ''
                    && (str_starts_with($href, 'http://') || str_starts_with($href, 'https://'));

                if ($isExternal) {
                    // Replace or add rel attribute
                    if (preg_match('/\srel=["\'][^"\']*["\']/i', $attrs)) {
                        $attrs = preg_replace('/\srel=["\'][^"\']*["\']/i', ' rel="nofollow ugc"', $attrs);
                    } else {
                        $attrs .= ' rel="nofollow ugc"';
                    }
                } else {
                    // Remove rel/target from internal links
                    $attrs = preg_replace('/\s(?:rel|target)=["\'][^"\']*["\']/i', '', $attrs);
                }

                return '<a ' . trim($attrs) . '>';
            },
            $html
        ) ?? $html;

        return $html;
    }

    /**
     * Normalise HTML structure for wpautop compatibility.
     *
     * Wpautop (run by comment_text filter) wraps double-newline-separated
     * text blocks in <p> tags.  If the content already has <p> tags we must
     * not double-wrap it — hence we ensure block-level elements are separated
     * by newlines, not embedded in paragraph soup.
     */
    private function normalize(string $html): string
    {
        // Remove paragraphs containing only whitespace or &nbsp;
        $html = preg_replace('/<p>(?:\s|&nbsp;)*<\/p>/i', '', $html) ?? $html;

        // Ensure block-level elements are on their own lines (wpautop expects this)
        $blockTags = 'p|ul|ol|li|blockquote|pre';
        $html = preg_replace("/(<\\/(?:{$blockTags})>)(?!\n)/i", "$1\n", $html) ?? $html;
        $html = preg_replace("/(?<!\n)(<(?:{$blockTags})[^>]*>)/i", "\n$1", $html) ?? $html;

        // Classes are an allowlist, not a blocklist.
        //
        // This used to strip `ql-*` and leave everything else, which was fine
        // while no tag admitted `class` at all. Now that links do — for the
        // mention marker — anything else in there is a class somebody typed,
        // and a comment is not a place to hand out the site's stylesheet.
        $html = preg_replace_callback(
            '/\sclass=(["\'])([^"\']*)\1/i',
            static function (array $m): string {
                $quote = $m[1];
                $kept = array_intersect(
                    preg_split('/\s+/', trim($m[2])) ?: [],
                    self::ALLOWED_CLASSES
                );

                return $kept === [] ? '' : " class={$quote}" . implode(' ', $kept) . "{$quote}";
            },
            $html
        ) ?? $html;

        // Remove all inline styles
        $html = preg_replace('/\sstyle=(["\'])[^"\']*\1/i', '', $html) ?? $html;

        // Collapse multiple blank lines
        $html = preg_replace('/\n{3,}/', "\n\n", $html) ?? $html;

        return trim($html);
    }
}
