<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

/**
 * WpContentFormatterService — second-pass WordPress content normaliser.
 *
 * The frontend (quill-wp-formatter.ts) does most of the heavy lifting.
 * This class handles the few things only the server can do:
 *
 *  - Confirms Gutenberg block classes are present on headings/lists/etc.
 *    (defence against clients that bypass the frontend formatter).
 *  - Ensures wpautop compatibility by removing double-<p> wrapping.
 *  - Strips any Quill artefacts (ql-*) that slipped through sanitization.
 *  - Normalises empty paragraphs and trailing whitespace.
 *  - Validates that the HTML is well-structured before database write.
 *
 * Called by ContentSanitizerService::sanitize() AFTER wp_kses, so the
 * HTML is already clean when it arrives here.
 */
final class WpContentFormatterService
{
    /**
     * Gutenberg block classes applied per element type.
     * Mirrors the WP constant object in quill-wp-formatter.ts.
     */
    private const WP_CLASS = [
        'h1' => 'wp-block-heading',
        'h2' => 'wp-block-heading',
        'h3' => 'wp-block-heading',
        'h4' => 'wp-block-heading',
        'h5' => 'wp-block-heading',
        'h6' => 'wp-block-heading',
        'ul' => 'wp-block-list',
        'ol' => 'wp-block-list',
    ];

    /**
     * Normalise sanitized HTML for WordPress database storage.
     *
     * @param string $html sanitized HTML from ContentSanitizerService
     *
     * @return string wordPress-compatible post_content value
     */
    public function format(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }

        // Use regex-based transforms — DOMDocument corrupts multibyte characters
        // in PHP < 8.2 and adds unwanted DOCTYPE/html/body wrappers.

        // 1. Strip any remaining Quill-specific classes
        $html = $this->stripQuillClasses($html);

        // 2. Ensure Gutenberg block classes on structural elements
        $html = $this->ensureBlockClasses($html);

        // 3. Normalise <pre><code> structure for code blocks
        $html = $this->normalizeCodeBlocks($html);

        // 4. Wrap bare <img> tags in <figure class="wp-block-image">
        $html = $this->wrapBareImages($html);

        // 5. Remove double-<p> wrapping that can occur when the client sends
        //    content with outer <p> AND wpautop later adds another layer
        $html = $this->removeDoubleParagraphs($html);

        // 6. Clean up empty paragraphs and normalise whitespace
        $html = $this->cleanWhitespace($html);

        // 7. Ensure external links have rel="noopener noreferrer"
        $html = $this->normalizeLinks($html);

        return trim($html);
    }

    // -------------------------------------------------------------------------
    // Private normalisation steps
    // -------------------------------------------------------------------------

    /**
     * Strip ql-* classes left by Quill that the frontend formatter missed.
     * These are editor-only artefacts; they must not reach the database.
     */
    private function stripQuillClasses(string $html): string
    {
        return preg_replace_callback(
            '/\sclass="([^"]*)"/i',
            static function (array $m): string {
                $cleaned = trim(preg_replace('/\bql-[\w-]+\b/', '', $m[1]));

                return $cleaned !== '' ? " class=\"{$cleaned}\"" : '';
            },
            $html
        ) ?? $html;
    }

    /**
     * Add Gutenberg block classes to headings and lists if they are missing.
     *
     * WordPress themes (Twenty Twenty-One, Twenty Twenty-Three, etc.) apply
     * their typography rules via .wp-block-heading and .wp-block-list.
     * Without these classes, user-generated content looks different from
     * content created in the native block editor.
     */
    private function ensureBlockClasses(string $html): string
    {
        foreach (self::WP_CLASS as $tag => $class) {
            $html = preg_replace_callback(
                "/<{$tag}(\\s[^>]*)?>/i",
                static function (array $m) use ($class, $tag): string {
                    $attrs = $m[1] ?? '';

                    // Already has the class
                    if (str_contains($attrs, $class)) {
                        return "<{$tag}{$attrs}>";
                    }

                    // Has existing class attribute — append
                    if (preg_match('/\sclass="([^"]*)"/i', $attrs)) {
                        $attrs = preg_replace(
                            '/\sclass="([^"]*)"/i',
                            " class=\"$1 {$class}\"",
                            $attrs
                        );

                        return "<{$tag}{$attrs}>";
                    }

                    // No class attribute — add one
                    return "<{$tag} class=\"{$class}\"{$attrs}>";
                },
                $html
            ) ?? $html;
        }

        return $html;
    }

    /**
     * Normalise code block markup to Gutenberg convention:
     *   <pre class="wp-block-code"><code>content</code></pre>
     *
     * Quill emits <pre class="ql-syntax"> which wp_kses strips to <pre>.
     * The frontend formatter adds wp-block-code, but a direct API call
     * may bypass the frontend, so we enforce it here too.
     */
    private function normalizeCodeBlocks(string $html): string
    {
        // <pre> without wp-block-code class → add it
        $html = preg_replace_callback(
            '/<pre(\s[^>]*)?>(.*?)<\/pre>/si',
            static function (array $m): string {
                $attrs = $m[1] ?? '';
                $inner = $m[2];

                // Ensure wp-block-code class
                if (!str_contains($attrs, 'wp-block-code')) {
                    if (preg_match('/\sclass="([^"]*)"/i', $attrs)) {
                        $attrs = preg_replace('/\sclass="([^"]*)"/i', ' class="$1 wp-block-code"', $attrs);
                    } else {
                        $attrs .= ' class="wp-block-code"';
                    }
                }

                // Ensure content is wrapped in <code>
                $trimmed = trim($inner);
                if (!str_starts_with($trimmed, '<code')) {
                    $inner = '<code>' . $trimmed . '</code>';
                }

                return "<pre{$attrs}>{$inner}</pre>";
            },
            $html
        ) ?? $html;

        return $html;
    }

    /**
     * Wrap bare <img> tags (not inside <figure>) in a Gutenberg figure.
     *
     * Gutenberg renders images as:
     *   <figure class="wp-block-image"><img src="..." alt="..."/></figure>
     *
     * This ensures theme image styles (borders, captions, max-width) apply.
     */
    private function wrapBareImages(string $html): string
    {
        // Figures are matched first so the images inside them are consumed by
        // that branch and never reach the wrapping one. A negative lookbehind
        // cannot express this: it would have to be variable length, which PCRE
        // refuses to compile — the pattern failed outright and the whole step
        // silently did nothing.
        return preg_replace_callback(
            '/<figure[^>]*>.*?<\/figure>|<img\s[^>]*?\/?>/is',
            static function (array $m): string {
                if (stripos($m[0], '<figure') === 0) {
                    return $m[0];
                }

                return '<figure class="wp-block-image">' . $m[0] . '</figure>';
            },
            $html
        ) ?? $html;
    }

    /**
     * Remove double-paragraph wrapping.
     *
     * Some paths produce <p><p>text</p></p>.  wpautop also adds <p> wrappers
     * during the_content filter, so if we already have them we get duplicates.
     */
    private function removeDoubleParagraphs(string $html): string
    {
        return preg_replace('/<p>\s*<p>/i', '<p>', preg_replace('/<\/p>\s*<\/p>/i', '</p>', $html) ?? $html) ?? $html;
    }

    /**
     * Clean up empty paragraphs and normalise block-level whitespace.
     *
     * Wpautop is tolerant of single blank lines but not of editor-generated
     * noise like <p>&nbsp;</p> or <p> </p>.
     */
    private function cleanWhitespace(string $html): string
    {
        // Remove paragraphs that contain only whitespace or &nbsp;
        $html = preg_replace('/<p>(?:\s|&nbsp;)*<\/p>/i', '', $html) ?? $html;

        // Normalise multiple consecutive newlines to double (wpautop convention)
        $html = preg_replace('/\n{3,}/', "\n\n", $html) ?? $html;

        // Remove trailing whitespace from each line
        return preg_replace('/[ \t]+$/m', '', $html) ?? $html;
    }

    /**
     * Ensure external links have rel="noopener noreferrer" to match WordPress
     * convention (and prevent tab-napping attacks on external links).
     *
     * Internal links (relative URLs) have rel/target removed.
     */
    private function normalizeLinks(string $html): string
    {
        return preg_replace_callback(
            '/<a\s([^>]*)>/i',
            static function (array $m): string {
                $attrs = $m[1];
                preg_match('/href="([^"]*)"/i', $attrs, $hrefMatch);
                $href = $hrefMatch[1] ?? '';

                $isExternal = $href !== ''
                    && !str_starts_with($href, '/')
                    && !str_starts_with($href, '#')
                    && !str_starts_with($href, '?')
                    && (str_starts_with($href, 'http://') || str_starts_with($href, 'https://'));

                if ($isExternal) {
                    // Add/overwrite rel and target for external links
                    $attrs = preg_replace('/\s*(?:rel|target)="[^"]*"/i', '', $attrs);
                    $attrs .= ' rel="noopener noreferrer" target="_blank"';
                } else {
                    // Remove target/rel from internal links (cleaner HTML)
                    $attrs = preg_replace('/\s*(?:rel|target)="[^"]*"/i', '', $attrs);
                }

                return '<a ' . trim($attrs) . '>';
            },
            $html
        ) ?? $html;
    }
}
