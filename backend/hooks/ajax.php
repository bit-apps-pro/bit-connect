<?php

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
use BitApps\BitConnect\Http\Controller\LoginController;

if (!defined('ABSPATH')) {
    exit;
}

// AJAX modal login (both logged-in and logged-out users — guest login attempt)
Route::post('ajax_login', [LoginController::class, 'login']);

// AJAX logout
Route::post('ajax_logout', [LoginController::class, 'logout']);
