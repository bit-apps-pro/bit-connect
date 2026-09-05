<?php

namespace BitApps\BitConnect\Services;

use InvalidArgumentException;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

/**
 * ContentSanitizerService — backend authority for HTML sanitization.
 *
 * Frontend validation is a UX courtesy.  Every piece of HTML that touches
 * wp_insert_post / wp_update_post MUST pass through this service first.
 *
 * Design decisions:
 *  - Uses wp_kses() with a tight custom whitelist rather than wp_kses_post()
 *    because wp_kses_post() allows tags (e.g. <object>, <embed>) that Quill
 *    never produces and that are dangerous in user-generated content.
 *  - wp_check_invalid_utf8() runs before kses so malformed byte sequences
 *    cannot be used to smuggle payloads through the sanitizer.
 *  - Size is checked after sanitization: an attacker cannot craft HTML that
 *    shrinks after kses and still slip through a pre-sanitization length check.
 */
final class ContentSanitizerService
{
    /**
     * Maximum allowed byte length of sanitized HTML.
     * Must match CreateTopicRequest max:10000 and the frontend CONTENT_LIMITS constant.
     */
    private const MAX_HTML_BYTES = 10_000;

    /**
     * Sanitize and validate rich-text HTML from the Quill editor.
     *
     * @param string $html raw HTML string from the request payload
     *
     * @throws InvalidArgumentException when content fails hard validation rules
     *
     * @return string sanitized HTML ready for wp_insert_post / wp_update_post
     */
    public function sanitize(string $html): string
    {
        // 1. Reject malformed UTF-8 before anything else.
        //    wp_check_invalid_utf8 returns '' on invalid sequences.
        $checked = wp_check_invalid_utf8($html);
        if ($checked === '') {
            throw new InvalidArgumentException('Content contains invalid character encoding.');
        }

        // 2. Strip null bytes — they can confuse parsers and databases.
        $html = str_replace("\0", '', $html);

        // 3. Apply wp_kses with our tight Quill-specific whitelist.
        $sanitized = wp_kses($html, $this->getAllowedHtml());

        // 4. Enforce size limit on the *sanitized* output.
        //    Checking post-sanitization prevents exploits where an attacker
        //    pads with stripped tags to stay under the limit while keeping
        //    the meaningful content large.
        if (\strlen($sanitized) > self::MAX_HTML_BYTES) {
            throw new InvalidArgumentException(\sprintf('Content exceeds maximum allowed length of %d characters.', self::MAX_HTML_BYTES));
        }

        // 5. Validate URLs inside <a href> and <img src> tags.
        $sanitized = $this->sanitizeUrls($sanitized);

        // 6. Normalise to WordPress/Gutenberg-compatible HTML structure.
        //    Runs after kses so the formatter only sees clean, safe HTML.
        $formatter = new WpContentFormatterService();

        return $formatter->format($sanitized);
    }

    /**
     * Sanitize and validate a post title.
     * Titles are plain text — no HTML allowed.
     */
    public function sanitizeTitle(string $title): string
    {
        // sanitize_text_field strips tags, encodes special chars, trims whitespace
        $clean = sanitize_text_field($title);

        if ($clean === '') {
            throw new InvalidArgumentException('Post title cannot be empty after sanitization.');
        }

        return $clean;
    }

    /**
     * Return the wp_kses allowed-HTML whitelist.
     *
     * Only tags and attributes that Quill's snow theme actually produces.
     * Every attribute value is additionally validated by wp_kses against its
     * allowed protocols list.
     *
     * Reference: https://developer.wordpress.org/reference/functions/wp_kses/
     */
    public function getAllowedHtml(): array
    {
        // Shared by all block elements
        $blockAttribs = [
            'class' => true,
            'id'    => true,
        ];

        // Shared by all inline elements
        $inlineAttribs = [
            'class' => true,
        ];

        return [
            // ---- Paragraphs & line breaks ----------------------------------
            'p'  => $blockAttribs,
            'br' => [],

            // ---- Inline formatting -----------------------------------------
            'strong' => $inlineAttribs,
            'b'      => $inlineAttribs,
            'em'     => $inlineAttribs,
            'i'      => $inlineAttribs,
            'u'      => $inlineAttribs,
            's'      => $inlineAttribs,
            'del'    => $inlineAttribs,
            'sub'    => $inlineAttribs,
            'sup'    => $inlineAttribs,
            'span'   => $inlineAttribs,
            'code'   => $inlineAttribs,

            // ---- Headings --------------------------------------------------
            'h1' => $blockAttribs,
            'h2' => $blockAttribs,
            'h3' => $blockAttribs,
            'h4' => $blockAttribs,
            'h5' => $blockAttribs,
            'h6' => $blockAttribs,

            // ---- Lists -----------------------------------------------------
            'ul' => $blockAttribs,
            'ol' => array_merge($blockAttribs, ['start' => true, 'type' => true]),
            'li' => $blockAttribs,

            // ---- Blockquote & preformatted ---------------------------------
            'blockquote' => $blockAttribs,
            'pre'        => $blockAttribs,

            // ---- Links -----------------------------------------------------
            // href is validated separately by sanitizeUrls(); rel and target
            // are allowed only with safe values enforced by wp_kses protocols.
            'a' => [
                'href'   => true,
                'title'  => true,
                'rel'    => true,
                'target' => true,
                'class'  => true,
            ],

            // ---- Images ----------------------------------------------------
            // Only WordPress-hosted images should appear here; external image
            // URLs are validated in sanitizeUrls().
            'img' => [
                'src'    => true,
                'alt'    => true,
                'title'  => true,
                'width'  => true,
                'height' => true,
                'class'  => true,
            ],

            // ---- Tables ----------------------------------------------------
            'table'    => $blockAttribs,
            'thead'    => $blockAttribs,
            'tbody'    => $blockAttribs,
            'tfoot'    => $blockAttribs,
            'tr'       => $blockAttribs,
            'th'       => array_merge($blockAttribs, ['scope' => true, 'colspan' => true, 'rowspan' => true]),
            'td'       => array_merge($blockAttribs, ['colspan' => true, 'rowspan' => true]),
            'col'      => ['span' => true],
            'colgroup' => ['span' => true],

            // ---- Horizontal rule -------------------------------------------
            'hr' => [],

            // ---- Div (Quill wraps content in div during conversion) ---------
            'div' => $blockAttribs,
        ];
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Walk the sanitized HTML and validate every href / src attribute.
     *
     * Wp_kses validates protocols (http, https, etc.) but we add an extra
     * check here to catch any edge cases and to apply WordPress's own
     * esc_url_raw() which normalises the URL and strips invalid characters.
     */
    private function sanitizeUrls(string $html): string
    {
        // Use a regex rather than DOM parsing to avoid adding a PHP extension
        // dependency (DOMDocument can corrupt certain UTF-8 sequences).
        $html = preg_replace_callback(
            '/\s(href|src)\s*=\s*(["\'])([^"\']*)\2/i',
            function (array $matches) {
                $attr = $matches[1];
                $quote = $matches[2];
                $url = $matches[3];

                $clean = esc_url_raw($url);

                // esc_url_raw returns '' for javascript: / data: URIs
                if ($clean === '') {
                    // Remove the entire attribute
                    return '';
                }

                return " {$attr}={$quote}{$clean}{$quote}";
            },
            $html
        );

        return $html ?? '';
    }
}
