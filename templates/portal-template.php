<?php
/**
 * Single template for portal with classic themes.
 */
if (!defined('ABSPATH')) {
    exit;
}

if (function_exists('get_header')) {
    get_header();
} else {
    // Complete HTML structure when theme header doesn't exist
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>

<head>
	<meta
		charset="<?php bloginfo('charset'); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
	<?php wp_body_open(); ?>
	<?php
}
?>

	<div class="bit-connect-single-wrapper">
		<div class="bit-connect-single-main-content">
			<?php
    the_content();
?>
		</div>
	</div>
	</div>

	<?php
if (function_exists('get_footer')) {
    get_footer();
} else {
    // Complete footer structure
    wp_footer();
    ?>
</body>

</html>
<?php
}

?>