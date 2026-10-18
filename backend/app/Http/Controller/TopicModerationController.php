<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Enum\Taxonomies;
use BitApps\BitConnect\Http\Requests\BulkTopicActionRequest;
use BitApps\BitConnect\Http\Requests\GetModerationTopicFiltersRequest;
use BitApps\BitConnect\Http\Requests\ListModerationTopicsRequest;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\TopicModerationService;
use BitApps\BitConnect\Services\TopicTaxonomies;
use WP_Term;

/**
 * The admin's Topics screen: every topic in one table, and what a moderator can
 * do to several of them at once.
 *
 * Changing one topic from a row goes through the topic endpoint itself
 * (TopicController::update), as it does in the portal.
 */
final class TopicModerationController
{
    public function index(ListModerationTopicsRequest $request)
    {
        $validated = $request->validated();

        $terms = [];
        foreach (array_keys(TopicTaxonomies::all()) as $param) {
            $terms[$param] = (int) ($validated[$param] ?? 0);
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 20);

        $result = (new TopicModerationService())->list(
            [
                'page'       => $page,
                'per_page'   => $perPage,
                'search'     => (string) ($validated['search'] ?? ''),
                'author'     => (int) ($validated['author_id'] ?? 0),
                'status'     => (int) ($validated['status'] ?? 0),
                'stage'      => (int) ($validated['stage'] ?? 0),
                'topic_type' => (int) ($validated['topic_type'] ?? 0),
                'visibility' => (string) ($validated['visibility'] ?? ''),
                'orderby'    => (string) ($validated['orderby'] ?? 'date'),
                'order'      => (string) ($validated['order'] ?? 'desc'),
                'view'       => (string) ($validated['view'] ?? ''),
                'terms'      => $terms,
            ]
        );

        return Response::success(
            [
                'data'       => $result['rows'],
                'pagination' => [
                    'current_page' => $page,
                    'per_page'     => $perPage,
                    'total'        => $result['total'],
                    'total_pages'  => (int) ceil($result['total'] / max(1, $perPage)),
                ],
            ]
        );
    }

    /**
     * What the table can filter by beyond this plugin's own taxonomies, and
     * which of the row actions this moderator may take.
     *
     * $request is unread on purpose — the type hint *is* the authorization.
     */
    // phpcs:ignore VariableAnalysis.CodeAnalysis.VariableAnalysis.UnusedVariable -- see above
    public function filters(GetModerationTopicFiltersRequest $request)
    {
        return Response::success(
            [
                'taxonomies' => TopicModerationService::filterTaxonomies(),
                'abilities'  => [
                    'lock'       => PermissionService::canLockPost(),
                    'delete_any' => PermissionService::canDeleteAny(),
                ],
            ]
        );
    }

    public function bulk(BulkTopicActionRequest $request)
    {
        $validated = $request->validated();
        $action = (string) $validated['action'];

        $allowed = match ($action) {
            'lock', 'unlock' => PermissionService::canLockPost(),
            'delete'         => PermissionService::canDeleteAny(),
            default          => true,
        };

        if (!$allowed) {
            return Response::error(__('You do not have permission to do that to posts.', 'bit-connect'), 403);
        }

        $termId = null;

        if ($action === 'set_status' || $action === 'set_stage') {
            $taxonomy = $action === 'set_status' ? Taxonomies::STATUSES->value : Taxonomies::STAGES->value;
            $termId = (int) ($validated['term_id'] ?? 0);

            if (!get_term($termId, $taxonomy) instanceof WP_Term) {
                return Response::error(['term_id' => [__('Choose a status or stage that exists.', 'bit-connect')]], 422)
                    ->message(__('Choose a status or stage that exists.', 'bit-connect'));
            }
        }

        $service = new TopicModerationService();
        $results = [];
        $counts = [
            TopicModerationService::OUTCOME_DONE    => 0,
            TopicModerationService::OUTCOME_SKIPPED => 0,
            TopicModerationService::OUTCOME_FAILED  => 0,
        ];

        foreach (array_values(array_unique(array_map('intval', (array) $validated['ids']))) as $id) {
            $outcome = $service->apply($action, $id, $termId);
            $results[] = ['id' => $id, 'outcome' => $outcome];
            ++$counts[$outcome];
        }

        return Response::success(['results' => $results, 'counts' => $counts]);
    }
}
