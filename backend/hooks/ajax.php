<?php

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
use BitApps\BitConnect\Http\Controller\LoginController;
use BitApps\BitConnect\Http\Controller\PluginImprovementController;

if (!defined('ABSPATH')) {
    exit;
}

// AJAX modal login (both logged-in and logged-out users — guest login attempt)
Route::post('ajax_login', [LoginController::class, 'login']);

// AJAX logout
Route::post('ajax_logout', [LoginController::class, 'logout']);

/*
 * Diagnostic-data consent.
 *
 * The `pro_` in the name is not a mistake and this is not a pro route. The
 * shared support screen asks for `pro_plugin-improvement`, and this router
 * prefixes with the free plugin's own `bit_connect_`, so the action it sends —
 * bit_connect_pro_plugin-improvement — is answered here. The other Bit Apps
 * plugins keep telemetry in their pro add-on, which is where that name comes
 * from; Bit Connect reports from the free plugin, so the free plugin has to
 * answer, or a site without a licence could never turn reporting off.
 */
Route::get('pro_plugin-improvement', [PluginImprovementController::class, 'getData'])->middleware('adminNonce');
Route::post('pro_plugin-improvement', [PluginImprovementController::class, 'createOrUpdate'])->middleware('adminNonce');
