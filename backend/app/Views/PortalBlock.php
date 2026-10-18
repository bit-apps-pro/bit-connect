<?php

namespace BitApps\BitConnect\Views;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;

/**
 * The portal as a block: the same thing as the `[bit-connect]` shortcode, with
 * a picture of itself for the editor.
 *
 * WordPress never renders a shortcode inside the editor, so a page holding
 * only `[bit-connect]` shows a line of text there — in the page editor, and in
 * the template picker's thumbnail of the portal template. A block may draw
 * itself, so the page the plugin creates carries this instead. On the live
 * page the two are identical: the block renders through the shortcode.
 *
 * The shortcode stays. It is what pages made before this block carry, and what
 * someone pastes into a page builder that has no blocks.
 */
final class PortalBlock
{
    public const NAME = 'bit-connect/portal';

    /**
     * What a page created by the plugin is given as its content.
     */
    public const MARKUP = '<!-- wp:bit-connect/portal /-->';

    private const EDITOR_HANDLE = 'bit_connect_portal_block_editor';

    public static function register(): void
    {
        $dir = Config::get('BASEDIR') . DIRECTORY_SEPARATOR . 'blocks' . DIRECTORY_SEPARATOR . 'portal';
        $uri = Config::get('ROOT_URI') . '/backend/blocks/portal';

        // Registered by handle rather than as `file:` paths in block.json, so
        // both carry the plugin's version and a release busts their cache. In
        // development the files change without the version moving, so there
        // they are stamped with their own modification time instead.
        $version = Config::isDev() ? (string) filemtime($dir . DIRECTORY_SEPARATOR . 'index.js') . filemtime($dir . DIRECTORY_SEPARATOR . 'editor.css') : Config::VERSION;
        wp_register_script(
            self::EDITOR_HANDLE,
            $uri . '/index.js',
            ['wp-blocks', 'wp-element', 'wp-block-editor', 'wp-i18n'],
            $version,
            true
        );
        wp_set_script_translations(self::EDITOR_HANDLE, 'bit-connect');
        wp_register_style(self::EDITOR_HANDLE, $uri . '/editor.css', [], $version);

        register_block_type($dir, ['render_callback' => [self::class, 'render']]);
    }

    /**
     * One implementation of the portal's markup, not two: everything the
     * shortcode guards against — a second app root on a routed page, a closed
     * forum's guest — holds for the block because it is the shortcode.
     */
    public static function render(): string
    {
        return do_shortcode('[bit-connect]');
    }
}
