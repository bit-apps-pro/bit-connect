<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Http\Requests\GetNotificationPreferencesRequest;
use BitApps\BitConnect\Http\Requests\GetNotificationsRequest;
use BitApps\BitConnect\Http\Requests\MarkNotificationsReadRequest;
use BitApps\BitConnect\Http\Requests\SaveNotificationPreferencesRequest;
use BitApps\BitConnect\Services\NotificationPreferences;
use BitApps\BitConnect\Services\NotificationService;

/**
 * A member's own notifications, and how they want them.
 *
 * Every action here reads get_current_user_id() and none of them accepts a
 * member id. That is the whole authorization story: there is no way to name
 * somebody else, so there is no check to forget. The Requests only establish
 * that a person is logged in.
 *
 * Refusals are built as Response::error([])->message($text), never
 * Response::error($text) — the first argument to error() is the response *data*,
 * so wording passed there leaves `message` unset and both frontends read
 * error.message and nothing else. Same shape as ReportController.
 */
final class NotificationController
{
    public function feed(GetNotificationsRequest $request)
    {
        $validated = $request->validated();

        return Response::success(
            NotificationService::feed(
                get_current_user_id(),
                [
                    'page'     => (int) ($validated['page'] ?? 1),
                    'per_page' => (int) ($validated['per_page'] ?? 20),
                    'unread'   => !empty($validated['unread']),
                ]
            )
        );
    }

    /**
     * Just the badge number.
     *
     * Its own endpoint rather than a field on feed(): this is what the bell
     * polls, and making it fetch a page of rows to read one integer would put
     * the most frequent request on the site through the most expensive query it
     * has. Answered from a transient in the ordinary case.
     *
     * $request is unread on purpose — the type hint is the authorization. See
     * ReportController::reasons() for the same pattern.
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- see above
    public function count(GetNotificationsRequest $request)
    {
        return Response::success(['unread' => NotificationService::unreadCount(get_current_user_id())]);
    }

    public function markRead(MarkNotificationsReadRequest $request)
    {
        $validated = $request->validated();
        $userId = get_current_user_id();

        $ids = \is_array($validated['ids'] ?? null) ? $validated['ids'] : [];
        $all = !empty($validated['all']);

        if (!$all && $ids === []) {
            return Response::error([], 422)->message(__('Nothing was named to mark as read.', 'bit-connect'));
        }

        $marked = NotificationService::markRead($userId, $ids, $all);

        return Response::success(
            [
                'marked' => $marked,
                // Sent back rather than left to the client to decrement: a second
                // tab may have read some of these already, and a badge counted
                // down locally would drift below the truth and stay there.
                'unread' => NotificationService::unreadCount($userId),
            ]
        );
    }

    /**
     * The preference screen: every type this member may see, and the effective
     * answer per channel.
     *
     * $request is unread on purpose — the type hint is the authorization.
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- see above
    public function preferences(GetNotificationPreferencesRequest $request)
    {
        return Response::success(NotificationPreferences::screenFor(get_current_user_id()));
    }

    public function savePreferences(SaveNotificationPreferencesRequest $request)
    {
        $validated = $request->validated();
        $userId = get_current_user_id();

        $frequency = \is_string($validated['frequency'] ?? null) ? $validated['frequency'] : null;

        NotificationPreferences::save(
            $userId,
            \is_array($validated['types'] ?? null) ? $validated['types'] : [],
            $frequency
        );

        // The screen is returned rather than an acknowledgement, so the form
        // redraws from what was actually stored. A row the admin has locked is
        // silently dropped by save(), and a client that kept its own optimistic
        // state would go on showing a switch the forum did not accept.
        return Response::success(NotificationPreferences::screenFor($userId));
    }
}
