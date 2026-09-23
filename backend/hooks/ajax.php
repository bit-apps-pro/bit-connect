<?php

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
use BitApps\BitConnect\Http\Controller\LoginController;

if (!defined('ABSPATH')) {
    exit;
}

// AJAX modal login (both logged-in and logged-out users — guest login attempt).
// Guarded by AjaxLoginRequest, which verifies the `bit_connect_ajax_login`
// nonce handed out with the auth bootstrap. Logging out goes through the REST
// route `auth/logout`, under core's cookie-and-nonce check.
Route::post('ajax_login', [LoginController::class, 'login']);
