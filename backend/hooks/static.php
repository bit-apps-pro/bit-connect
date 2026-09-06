<?php

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
use BitApps\BitConnect\Http\Controller\NotFoundController;
use BitApps\BitConnect\Http\Controller\NotificationsPageController;
use BitApps\BitConnect\Http\Controller\TopicArchiveController;
use BitApps\BitConnect\Http\Controller\TopicDetailsController;
use BitApps\BitConnect\Http\Controller\TopicsController;
use BitApps\BitConnect\Http\Controller\UserProfilePageController;

if (!defined('ABSPATH')) {
    exit;
}

// Static routes that match the frontend routes defined in AppRoutes.tsx
// These routes handle server-side rendering for the corresponding frontend pages

// Root route - matches frontend route '/'
Route::get('/', [new TopicsController(), 'index']);

// Paginated list - matches frontend route '/page/:pageNumber'. These pages are a
// crawl path to topics older than the first screenful, not index entries; see
// SeoMeta::forTopics().
Route::get('/page/{pageNumber}', [new TopicsController(), 'index']);

// The member's own notifications - matches frontend route '/notifications'.
// Declared before the single-segment '/{slug}' route below, which would
// otherwise take it and look for a topic by that name. Static beats dynamic
// here only because this is declared first; the router matches in order.
Route::get('/notifications', [new NotificationsPageController(), 'show']);

// Member profile - matches frontend route '/user/:userId'. Declared before the
// single-segment topic route below; it is two segments, so it cannot be served
// by '/{slug}' and would otherwise fall through to a WordPress 404.
Route::get('/user/{userId}', [new UserProfilePageController(), 'show']);

// Term archives - matches frontend route '/:archiveSegment/:termSlug'. Declared
// after the profile route so `/user/{id}` still wins, and before the topic route
// below, which is single-segment and cannot match these anyway. An unknown
// segment or term is turned into a 404 by the controller rather than here.
Route::get('/{segment}/{termSlug}', [new TopicArchiveController(), 'show']);

// Topic details route - matches frontend route '/topics/details/:id'
Route::get('/{slug}', [new TopicDetailsController(), 'show']);

// Wildcard route for 404 handling - matches frontend route '*'
// Route::any('*', [new NotFoundController(), 'index']);
