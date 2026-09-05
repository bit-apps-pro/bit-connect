<?php

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Router\Route;
use BitApps\BitConnect\Http\Controller\AccountSecurityController;
use BitApps\BitConnect\Http\Controller\ActivityLogController;
use BitApps\BitConnect\Http\Controller\AdminSettingsController;
use BitApps\BitConnect\Http\Controller\AttachmentController;
use BitApps\BitConnect\Http\Controller\AuthApiController;
use BitApps\BitConnect\Http\Controller\AuthController;
use BitApps\BitConnect\Http\Controller\AuthSettingsController;
use BitApps\BitConnect\Http\Controller\AvatarController;
use BitApps\BitConnect\Http\Controller\CapabilitySettingsController;
use BitApps\BitConnect\Http\Controller\CommentController;
use BitApps\BitConnect\Http\Controller\CoverController;
use BitApps\BitConnect\Http\Controller\DashboardController;
use BitApps\BitConnect\Http\Controller\FollowController;
use BitApps\BitConnect\Http\Controller\GeneralSettingsController;
use BitApps\BitConnect\Http\Controller\LoginController;
use BitApps\BitConnect\Http\Controller\MemberProfileController;
use BitApps\BitConnect\Http\Controller\MentionController;
use BitApps\BitConnect\Http\Controller\NotificationController;
use BitApps\BitConnect\Http\Controller\NotificationSettingsController;
use BitApps\BitConnect\Http\Controller\OnboardingController;
use BitApps\BitConnect\Http\Controller\PortalSlugController;
use BitApps\BitConnect\Http\Controller\PostController;
use BitApps\BitConnect\Http\Controller\ReportController;
use BitApps\BitConnect\Http\Controller\SeoSettingsController;
use BitApps\BitConnect\Http\Controller\TaxonomyController;
use BitApps\BitConnect\Http\Controller\TopicController;
use BitApps\BitConnect\Http\Controller\UserManagementController;
use BitApps\BitConnect\Http\Controller\UserProfileController;
use BitApps\BitConnect\Http\Controller\UserStatsController;
use BitApps\BitConnect\Http\Controller\VoteController;

if (!defined('ABSPATH')) {
    exit;
}

// Posts
Route::get('posts', [PostController::class, 'all']);
Route::post('posts', [PostController::class, 'create']);
Route::get('posts/{id}', [PostController::class, 'get']);

// Topic CRUD Routes
Route::get('topics', [TopicController::class, 'all']);
Route::post('topics', [TopicController::class, 'create']);
Route::get('topics/{id}', [TopicController::class, 'get']);
Route::post('topics/{id}', [TopicController::class, 'update']);
Route::get('topics-delete/{id}', [TopicController::class, 'delete']);
// Off the `topics/` prefix on purpose — `topics/{id}` would swallow it.
Route::get('topic-slug-check', [TopicController::class, 'slugCheck']);
Route::get('posts/filter', [PostController::class, 'filter']);

// Comments
Route::get('posts/{id}/comments', [CommentController::class, 'getByPost']);
Route::post('posts/{id}/comments', [CommentController::class, 'create']);
Route::post('comments/{id}', [CommentController::class, 'update']);
Route::get('comments-delete/{id}', [CommentController::class, 'delete']);

// The editor's "@" picker. A read of the member list, so it sits with the
// composer it serves rather than under the public `users/` routes below — those
// answer about one member the caller already named.
Route::get('mentions/search', [MentionController::class, 'search']);

// Reports. Filing is open to any forum participant (CreateReportRequest);
// the queue and resolution are forum_moderate.
Route::post('reports', [ReportController::class, 'create']);
Route::get('reports/reasons', [ReportController::class, 'reasons']);
Route::get('reports', [ReportController::class, 'queue']);
Route::post('reports/resolve', [ReportController::class, 'resolve']);

// Notifications. A member's own only — none of these take a user id, so there is
// no "unless it is someone else's" check to forget. See NotificationController.
Route::get('notifications', [NotificationController::class, 'feed']);
// Its own route because the bell polls it: reading one integer must not cost a
// page of rows.
Route::get('notifications/count', [NotificationController::class, 'count']);
Route::post('notifications/read', [NotificationController::class, 'markRead']);
Route::get('notification-preferences', [NotificationController::class, 'preferences']);
Route::post('notification-preferences', [NotificationController::class, 'savePreferences']);

// Forum-wide notification settings (forum_manage — enforced in each Request).
// Separate from notification-preferences above, which is a member answering for
// themselves; these decide what the forum is allowed to send at all.
Route::get('notification-settings', [NotificationSettingsController::class, 'get']);
Route::post('notification-settings/update', [NotificationSettingsController::class, 'update']);
// Takes no recipient — it mails the signed-in admin. See the Request.
Route::post('notification-settings/test-email', [NotificationSettingsController::class, 'sendTest']);

// Following. One toggle rather than a follow/unfollow pair — a double click on
// two endpoints leaves the member where they started.
Route::post('follows/toggle', [FollowController::class, 'toggle']);
Route::get('follows', [FollowController::class, 'mine']);

// Activity log — who did what to content they did not write. forum_moderate,
// enforced in GetActivityLogRequest::authorize().
Route::get('activity-log', [ActivityLogController::class, 'feed']);
Route::get('activity-log/actions', [ActivityLogController::class, 'actions']);

// Votes
Route::post('posts/{id}/vote', [VoteController::class, 'togglePostVote']);
Route::post('comments/{id}/vote', [VoteController::class, 'toggleCommentVote']);
Route::get('posts/{id}/votes', [VoteController::class, 'getPostVotes']);
Route::get('comments/{id}/votes', [VoteController::class, 'getCommentVotes']);

Route::get('taxonomies', [TaxonomyController::class, 'getTaxonomies']);

// Term CRUD uses the core terms endpoint; only ordering needs a plugin route.
Route::post('taxonomies/{taxonomy}/reorder', [TaxonomyController::class, 'reorder']);

// Public contribution totals for a topic author's card. Separate from the
// admin-only user management routes below.
Route::get('users/{id}/stats', [UserStatsController::class, 'stats']);

// Public member profile. `votes` is the exception: it is owner/moderator only,
// enforced in GetUserVotesRequest::authorize().
Route::get('users/{id}/profile', [UserProfileController::class, 'profile']);
Route::get('users/{id}/topics', [UserProfileController::class, 'topics']);
Route::get('users/{id}/comments', [UserProfileController::class, 'comments']);
Route::get('users/{id}/votes', [UserProfileController::class, 'votes']);
Route::get('users/{id}/overview', [UserProfileController::class, 'overview']);
Route::get('users/{id}/pinned', [UserProfileController::class, 'pinned']);
Route::get('users/{id}/permissions', [UserProfileController::class, 'permissions']);

// Self-service profile editing (owner only — see each Request's authorize()).
Route::post('users/{id}/profile', [MemberProfileController::class, 'update']);
Route::post('users/{id}/avatar', [AvatarController::class, 'upload']);
Route::post('users/{id}/avatar/remove', [AvatarController::class, 'remove']);
Route::post('users/{id}/cover', [CoverController::class, 'upload']);
Route::post('users/{id}/cover/remove', [CoverController::class, 'remove']);

// Account security (owner only). The email change is only parked here — it is
// applied by auth/verify-email-change below.
Route::post('users/{id}/password', [AccountSecurityController::class, 'changePassword']);
Route::post('users/{id}/password/reset-link', [AccountSecurityController::class, 'sendPasswordReset']);
Route::post('users/{id}/email', [AccountSecurityController::class, 'requestEmailChange']);

// Attachments
Route::post('attachments', [AttachmentController::class, 'upload']);
Route::post('attachments/delete', [AttachmentController::class, 'delete']);

// Onboarding Routes
Route::get('onboarding-status', [OnboardingController::class, 'status']);
Route::post('onboarding-complete', [OnboardingController::class, 'complete']);

// Dashboard Route
Route::get('dashboard', [DashboardController::class, 'get']);

// Settings Routes
Route::get('settings', [AdminSettingsController::class, 'get']);
Route::post('settings/update', [AdminSettingsController::class, 'update']);

// General Settings Routes
Route::get('general-settings', [GeneralSettingsController::class, 'get']);
Route::post('general-settings/update', [GeneralSettingsController::class, 'update']);

// SEO Settings Routes (forum_manage cap required)
Route::get('seo-settings', [SeoSettingsController::class, 'get']);
Route::post('seo-settings/update', [SeoSettingsController::class, 'update']);

// Portal Page Routes
Route::get('portal-page', [PortalSlugController::class, 'getPage']);
Route::get('portal-page/check', [PortalSlugController::class, 'checkSlug']);
Route::post('portal-page', [PortalSlugController::class, 'createPage']);
Route::post('portal-page/slug', [PortalSlugController::class, 'updateSlug']);
Route::post('portal-page/root', [PortalSlugController::class, 'updateRootMode']);

// Authentication Routes
Route::get('auth/me', [AuthController::class, 'me']);
Route::post('auth/logout', [AuthController::class, 'logout']);

// Auth data bootstrap endpoint (public — no login required)
Route::get('auth/data', [LoginController::class, 'data']);

// Forum login / signup (public REST endpoints — CSRF via X-WP-Nonce header)
Route::post('auth/login', [AuthApiController::class, 'login']);
Route::post('auth/signup', [AuthApiController::class, 'signup']);
Route::post('auth/verify-email', [AuthApiController::class, 'verifyEmail']);
Route::post('auth/verify-email-change', [AccountSecurityController::class, 'confirmEmailChange']);
Route::post('auth/forgot-password', [AuthApiController::class, 'forgotPassword']);

// Authentication Settings Routes (admin only)
Route::get('auth-settings', [AuthSettingsController::class, 'get']);
Route::post('auth-settings/update', [AuthSettingsController::class, 'update']);

// Capability Settings Routes (forum_manage cap required)
Route::get('capability-settings', [CapabilitySettingsController::class, 'get']);
Route::post('capability-settings/update', [CapabilitySettingsController::class, 'update']);

// User Management Routes (forum_manage cap required)
Route::get('users', [UserManagementController::class, 'getUsers']);
Route::post('users/{id}/capabilities', [UserManagementController::class, 'updateUserCapabilities']);
Route::post('users/{id}/capabilities/reset', [UserManagementController::class, 'resetUserCapabilities']);

// Profile Badge routes live in the pro add-on — see pro/backend/hooks/api.php.
// The badges a member *wears* still ride on the free payloads; only authoring
// and assigning the catalog is pro.
