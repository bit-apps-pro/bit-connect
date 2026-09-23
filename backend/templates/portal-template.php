<?php

/**
 * Template Name: Bit Connect Portal Template.
 *
 * Full-width template for the Bit Connect portal page.
 */
if (!defined('ABSPATH')) {
    exit;
}

// Every echo below is a string literal; the template tags between them print
// and escape their own output.
echo '<!DOCTYPE html><html ';
language_attributes();
echo '><head><meta charset="';
bloginfo('charset');
echo '"><meta name="viewport" content="width=device-width, initial-scale=1">';
wp_head();
echo '</head><body ';
body_class();
echo '>';
wp_body_open();
echo '<div id="bit-connect-portal">';

while (have_posts()) {
    the_post();
    the_content();
}

echo '</div>';
wp_footer();
echo '</body></html>';
