<?php

/**
 * Analysis-only stubs. This file is never loaded at runtime.
 *
 * WordPress defines these cookie constants in wp-includes/default-constants.php
 * inside wp_cookie_constants(), which runs during bootstrap. Because they are
 * defined conditionally inside a function rather than at file scope,
 * php-stubs/wordpress-stubs does not declare them and PHPStan reports them as
 * unknown. They are always present by the time plugin hooks fire.
 */

\define('AUTH_COOKIE', '');
\define('SECURE_AUTH_COOKIE', '');
\define('LOGGED_IN_COOKIE', '');
