<?php

namespace BitApps\BitConnect\Http\Controller;

// Prevent direct script access
if (!\defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Config;
use BitApps\BitConnect\Deps\BitApps\WPKit\Hooks\Hooks;
use BitApps\BitConnect\Deps\BitApps\WPKit\Http\Response;
use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\ActivityActions;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Http\Requests\CreateCommentRequest;
use BitApps\BitConnect\Http\Requests\DeleteCommentRequest;
use BitApps\BitConnect\Http\Requests\GetCommentsByPostRequest;
use BitApps\BitConnect\Http\Requests\UpdateCommentRequest;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Model\Vote;
use BitApps\BitConnect\Services\ActivityLogService;
use BitApps\BitConnect\Services\CommentSanitizerService;
use BitApps\BitConnect\Services\ContentRemovalService;
use BitApps\BitConnect\Services\ContentVisibilityService;
use BitApps\BitConnect\Services\EditAttributionService;
use BitApps\BitConnect\Services\FollowService;
use BitApps\BitConnect\Services\MentionService;
use BitApps\BitConnect\Services\NotificationService;
use BitApps\BitConnect\Services\PermissionService;
use BitApps\BitConnect\Services\ProfileSlugService;
use BitApps\BitConnect\Services\ReportService;
use BitApps\BitConnect\Services\TopicService;
use BitApps\BitConnect\Services\UserBadgeService;
use InvalidArgumentException;
use WP_Comment;
use WP_Post;

final class CommentController
{
    public function getByPost(GetCommentsByPostRequest $request)
    {
        $postId = $request->id;

        $post = get_post($postId);
        if (!$post) {
            return Response::error('Post not found', 404);
        }

        $validated = $request->validated();
        $page = max(1, (int) ($validated['page'] ?? 1));
        $perPage = max(1, (int) ($validated['per_page'] ?? 10));
        $sort = $validated['sort'] ?? 'newest';
        if (!\in_array($sort, ['newest', 'all', 'mostVoted'], true)) {
            $sort = 'newest';
        }

        // Load every approved comment once, then split into top-level threads
        // and a parent => children map. Pagination is applied to the top-level
        // threads only; a thread's descendants always travel with it so the
        // frontend can rebuild the full tree for each page.
        // Same narrowing as TopicService::getTopicComments(): a comment hidden
        // by a report stays in the list so its replies keep their parent, and
        // everything else unapproved stays out.
        $allComments = ContentVisibilityService::filterVisibleComments(
            (array) get_comments(
                [
                    'post_id' => $postId,
                    'status'  => 'all',
                    'orderby' => 'comment_date',
                    'order'   => 'ASC',
                ]
            )
        );

        $topLevel = [];
        $childrenByParent = [];
        foreach ($allComments as $comment) {
            if ((int) $comment->comment_parent === 0) {
                $topLevel[] = $comment;
            } else {
                $childrenByParent[(int) $comment->comment_parent][] = $comment;
            }
        }

        $topLevel = $this->sortTopLevelComments($topLevel, $sort);

        $total = \count($topLevel);
        $totalPages = max(1, (int) ceil($total / $perPage));

        // A `#comment-N` link has to open on the page that actually holds N.
        // Resolved here rather than in the client because it depends on the
        // sort and on the whole thread list — the client would have to fetch
        // every page in turn to discover the same number.
        $focus = (int) ($validated['focus'] ?? 0);
        if ($focus > 0) {
            // Cast: the route hands `id` back as a string, and the comparison
            // inside is strict.
            $focusPage = $this->pageOfComment($focus, (int) $postId, $topLevel, $childrenByParent, $perPage);

            // Left on the requested page when the comment is gone, or belongs
            // to another topic: a deleted comment should still open the topic
            // rather than fail the whole request.
            if ($focusPage > 0) {
                $page = $focusPage;
            }
        }

        // Past the end once the list shrank under a stale page number.
        $page = min($page, $totalPages);
        $offset = ($page - 1) * $perPage;
        $pageTopLevel = \array_slice($topLevel, $offset, $perPage);

        // Flatten each page thread (top-level comment followed by its whole
        // subtree) into the response; the frontend nests them by parent id.
        $votesTable = $this->getVotesTable();
        $currentUserId = get_current_user_id();

        $formattedComments = [];
        $appendThread = function ($comment) use (&$appendThread, &$formattedComments, $childrenByParent, $votesTable, $currentUserId) {
            $formattedComments[] = $this->formatComment($comment, $votesTable, $currentUserId);
            $children = $childrenByParent[(int) $comment->comment_ID] ?? [];
            foreach ($children as $child) {
                $appendThread($child);
            }
        };
        foreach ($pageTopLevel as $comment) {
            $appendThread($comment);
        }

        return Response::success(
            [
                'data'       => $formattedComments,
                'pagination' => [
                    'total'        => $total,
                    'per_page'     => $perPage,
                    'current_page' => $page,
                    'total_pages'  => $totalPages,
                ],
            ]
        );
    }

    public function create(CreateCommentRequest $request)
    {
        $postId = $request->id;

        $post = get_post($postId);

        // Only forum topics accept comments — without this, anyone with the
        // create-comment cap could attach comments to any page/post on the site.
        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value) {
            return Response::error('Topic not found', 404);
        }

        // Respect topic lock (comment_status closed). Moderators bypass the lock.
        if ($post->comment_status !== 'open' && !WpCapabilities::check(Capabilities::MODERATE->value)) {
            return Response::error('This topic is locked.', 403);
        }

        $sanitizer = new CommentSanitizerService();

        try {
            $content = $sanitizer->sanitize($request->content);
        } catch (InvalidArgumentException $e) {
            return Response::error($e->getMessage(), 422);
        }

        $parentId = $request->parent_id ? (int) $request->parent_id : 0;
        $attachments = $request->attachments ?? [];

        if ($parentId > 0) {
            $parentComment = get_comment($parentId);
            if (!$parentComment || $parentComment->comment_post_ID != $postId) {
                return Response::error('Invalid parent comment', 400);
            }

            $depth = 1;
            $currentParent = $parentComment;
            while ($currentParent->comment_parent > 0 && $depth < 5) {
                $currentParent = get_comment($currentParent->comment_parent);
                ++$depth;
            }

            if ($depth >= 5) {
                return Response::error('Maximum comment nesting depth reached', 400);
            }
        }

        $currentUser = wp_get_current_user();

        // Honour the site's discussion setting: when comment moderation is on,
        // hold new comments for approval instead of auto-publishing them.
        $commentApproved = get_option('comment_moderation') ? 0 : 1;

        $commentData = [
            'comment_post_ID'      => $postId,
            'comment_author'       => $currentUser->display_name,
            'comment_author_email' => $currentUser->user_email,
            'comment_author_url'   => $currentUser->user_url,
            'comment_content'      => $content,
            'comment_type'         => 'comment',
            'comment_parent'       => $parentId,
            'user_id'              => $currentUser->ID,
            'comment_approved'     => $commentApproved,
        ];

        // wp_insert_comment() returns the new comment ID, or false on failure
        // (never a WP_Error) — so guard on a falsy return.
        $commentId = wp_insert_comment($commentData);

        if (!$commentId) {
            return Response::error('Failed to create comment.', 500);
        }

        if (!empty($attachments)) {
            update_comment_meta($commentId, '_comment_attachments', $attachments);
        }

        $comment = get_comment($commentId);
        if (!$comment) {
            return Response::error('Comment created but could not be retrieved', 500);
        }

        // After the write, never instead of it. A notification that could not be
        // sent is not a reason to tell the member their comment failed — the
        // comment is on the page either way, and the whole system is best-effort
        // by design.
        $this->notifyThread($post, $comment, $parentId);

        $votesTable = $this->getVotesTable();
        $formattedComment = $this->formatComment($comment, $votesTable, $currentUser->ID);

        return Response::success($formattedComment);
    }

    public function update(UpdateCommentRequest $request)
    {
        $commentId = $request->id;

        $comment = get_comment($commentId);
        if (!$comment) {
            return Response::error('Comment not found', 404);
        }

        $currentUser = wp_get_current_user();

        // The author, and nobody else. A moderator who thinks a reply has to go
        // removes it; there is no path here that rewrites it in their name.
        if ((int) $comment->user_id !== $currentUser->ID) {
            return Response::error(__('You are not allowed to edit this comment.', 'bit-connect'), 403);
        }

        $sanitizer = new CommentSanitizerService();

        try {
            $content = $sanitizer->sanitize($request->content);
        } catch (InvalidArgumentException $e) {
            return Response::error($e->getMessage(), 422);
        }

        $newAttachmentIds = $request->attachments !== null
            ? array_map('intval', (array) $request->attachments)
            : null;

        // Compared before the write: wp_update_comment() overwrites in place and
        // wp_comments carries no modified column, so once this returns there is
        // nothing left to tell an edit from the original.
        $contentChanged = $content !== $comment->comment_content;

        $result = wp_update_comment(
            [
                'comment_ID'      => $commentId,
                'comment_content' => $content,
            ]
        );

        if (is_wp_error($result)) {
            return Response::error('Failed to update comment: ' . $result->get_error_message(), 500);
        }

        // Attachments alone are not an edit to the words, so they do not mark
        // the comment as edited.
        // Nothing is logged alongside it: the guard above lets only the author
        // reach this point, and the activity log records what was done to
        // somebody else's content. The row this used to write could never be
        // reached once editing another member's comment was withdrawn.
        if ($contentChanged) {
            EditAttributionService::recordComment($commentId, $currentUser->ID);

            // An edit that adds a name is how somebody gets brought into a
            // conversation already under way — "@aiden this is the bug you
            // hit" — and the person brought in has heard nothing about it yet.
            $this->notifyAddedMentions($comment, $content);
        }

        if ($newAttachmentIds !== null) {
            $oldAttachmentIds = get_comment_meta($commentId, '_comment_attachments', true);
            if (!\is_array($oldAttachmentIds)) {
                $oldAttachmentIds = [];
            }

            $removedIds = array_diff(array_map('intval', $oldAttachmentIds), $newAttachmentIds);
            foreach ($removedIds as $removedId) {
                wp_delete_attachment($removedId, true);
            }

            if (!empty($newAttachmentIds)) {
                update_comment_meta($commentId, '_comment_attachments', $newAttachmentIds);
            } else {
                delete_comment_meta($commentId, '_comment_attachments');
            }
        }

        $updatedComment = get_comment($commentId);
        if (!$updatedComment) {
            return Response::error('Comment updated but could not be retrieved', 500);
        }

        $votesTable = $this->getVotesTable();
        $formattedComment = $this->formatComment($updatedComment, $votesTable, $currentUser->ID);

        return Response::success($formattedComment);
    }

    public function delete(DeleteCommentRequest $request)
    {
        $commentId = $request->id;

        $comment = get_comment($commentId);
        if (!$comment) {
            return Response::error('Comment not found', 404);
        }

        $currentUser = wp_get_current_user();

        if ((int) $comment->user_id !== $currentUser->ID && !PermissionService::canDeleteAny()) {
            return Response::error('You are not allowed to delete this comment', 403);
        }

        // Read before anything is destroyed. This delete takes the whole reply
        // subtree with it, so the count of what went with it is part of the
        // record — afterwards there is nothing left to count.
        $deleted = ContentRemovalService::describe(ReportService::TARGET_COMMENT, (int) $commentId);
        $deletedAuthor = (int) $comment->user_id;

        if (!ContentRemovalService::remove(ReportService::TARGET_COMMENT, (int) $commentId)) {
            return Response::error('Failed to delete comment', 500);
        }

        ActivityLogService::recordIfNotAuthor(
            ActivityActions::DELETE_COMMENT,
            ActivityLogService::TARGET_COMMENT,
            (int) $commentId,
            $deletedAuthor,
            $deleted
        );

        return Response::success(['id' => (int) $commentId]);
    }

    /**
     * Tells a thread that someone has written in it, and subscribes the writer.
     *
     * A comment is one event, however many descriptions of it are true, so the
     * three dispatches below run most specific first and each one tells the next
     * who has already been told. Somebody can easily be in all three sets — the
     * topic's author, answering a reply to their own topic, named in it — and
     * sending each would be one comment arriving three times.
     *
     * The ladder, narrowest first:
     *
     *   1. **replied to you** — one person, and the reply is addressed to them.
     *   2. **mentioned you** — the author typed their name on purpose.
     *   3. **commented on your topic** — true of everyone following the thread.
     *
     * Exclusion is unconditional, not conditional on a row actually being
     * written: a member who has mentions switched off has said they do not want
     * to hear about being named, not that they would rather hear about it as a
     * thread reply instead.
     *
     * The author of the comment is never a recipient of any of them:
     * NotificationService drops the actor unconditionally, so nothing here has
     * to remember to.
     *
     * @param WP_Comment $comment the comment just written
     */
    private function notifyThread(WP_Post $post, $comment, int $parentId): void
    {
        $commentId = (int) $comment->comment_ID;
        $topicId = (int) $post->ID;

        // Taking part subscribes you to the thread. Never unmutes: a member who
        // silenced this topic and then answered in it once more has said both
        // things, and the mute is the deliberate one.
        FollowService::autoFollow(get_current_user_id(), Follow::TARGET_TOPIC, $topicId);

        $context = [
            'topic_title' => (string) $post->post_title,
            'excerpt'     => ActivityLogService::excerpt(wp_strip_all_tags((string) $comment->comment_content)),
            // Built now, while the comment certainly exists. A link stored today
            // may 404 tomorrow, which the UI already handles: format() reports
            // whether the target still exists and the row falls back to the
            // stored title.
            'url' => (string) get_comment_link($comment),
        ];

        $repliedTo = [];

        if ($parentId > 0) {
            $context['in_reply_to'] = $parentId;

            NotificationService::dispatch(
                NotificationTypes::COMMENT_REPLY,
                NotificationService::TARGET_COMMENT,
                $commentId,
                $context,
                $topicId
            );

            // Whoever the reply was addressed to has now been told about this
            // comment once, which is enough.
            $parentAuthor = get_comment($parentId);
            $repliedTo = $parentAuthor && (int) $parentAuthor->user_id > 0
                ? [(int) $parentAuthor->user_id]
                : [];
        }

        // Read from the stored words, which are what everyone else will read
        // too: the request could name anybody, the comment can only name whoever
        // it actually says.
        $mentioned = MentionService::parse((string) $comment->comment_content);

        if ($mentioned !== []) {
            NotificationService::dispatch(
                NotificationTypes::MENTION,
                NotificationService::TARGET_COMMENT,
                $commentId,
                $context,
                $topicId,
                $mentioned,
                $repliedTo
            );
        }

        NotificationService::dispatch(
            NotificationTypes::TOPIC_REPLY,
            NotificationService::TARGET_COMMENT,
            $commentId,
            $context,
            $topicId,
            null,
            array_merge($repliedTo, $mentioned)
        );
    }

    /**
     * Tells whoever an edit newly named.
     *
     * Only the names the edit added. Re-telling everyone already in the comment
     * would make a corrected typo indistinguishable from being spoken to, and
     * would let anyone summon the same people again by saving the same words
     * repeatedly.
     *
     * @param WP_Comment $comment the comment as it stood before the write
     * @param string     $content the words as saved
     */
    private function notifyAddedMentions($comment, string $content): void
    {
        $mentioned = MentionService::added((string) $comment->comment_content, $content);

        if ($mentioned === []) {
            return;
        }

        $post = get_post((int) $comment->comment_post_ID);

        NotificationService::dispatch(
            NotificationTypes::MENTION,
            NotificationService::TARGET_COMMENT,
            (int) $comment->comment_ID,
            [
                'topic_title' => $post ? (string) $post->post_title : '',
                // The words as edited, not as written: what the recipient will
                // find when they follow the link is the version that names them.
                'excerpt' => ActivityLogService::excerpt(wp_strip_all_tags($content)),
                'url'     => (string) get_comment_link($comment),
            ],
            (int) $comment->comment_post_ID,
            $mentioned
        );
    }

    /**
     * Sort top-level comments by the requested key. Vote counts are
     * precomputed once (avoiding a query per comparison) for "mostVoted".
     *
     * @param WP_Comment[] $topLevel
     * @param string        $sort      one of newest|all|mostVoted
     *
     * @return WP_Comment[]
     */
    private function sortTopLevelComments($topLevel, $sort)
    {
        if ($sort === 'mostVoted') {
            $voteCounts = [];
            foreach ($topLevel as $comment) {
                $voteCounts[(int) $comment->comment_ID] = (int) Vote::getCommentVoteCount((int) $comment->comment_ID);
            }

            usort(
                $topLevel,
                static function ($a, $b) use ($voteCounts) {
                    $votesA = $voteCounts[(int) $a->comment_ID] ?? 0;
                    $votesB = $voteCounts[(int) $b->comment_ID] ?? 0;
                    if ($votesA !== $votesB) {
                        return $votesB - $votesA;
                    }

                    return strcmp($b->comment_date, $a->comment_date); // newer first on tie
                }
            );

            return $topLevel;
        }

        // "all" => oldest first, "newest" (default) => newest first.
        usort(
            $topLevel,
            static function ($a, $b) use ($sort) {
                return $sort === 'all'
                ? strcmp($a->comment_date, $b->comment_date)
                : strcmp($b->comment_date, $a->comment_date);
            }
        );

        return $topLevel;
    }

    /**
     * Which page of threads holds a comment, or 0 when it is not on this topic.
     *
     * Pagination counts top-level threads and a thread's descendants travel
     * with it, so a reply lives on whatever page its root ancestor does. The
     * walk up to that root goes through the same visible-comments map the page
     * was built from rather than re-querying: a reply whose parent was hidden
     * by a report is still in that map — it has to be, or its own children
     * would lose their parent — so the chain never breaks halfway.
     *
     * @param int             $commentId       the comment being linked to
     * @param int             $postId          topic the request is for
     * @param WP_Comment[]    $topLevel        threads, already in sort order
     * @param WP_Comment[][]  $childrenByParent parent id => children
     * @param int             $perPage         threads per page
     */
    private function pageOfComment($commentId, $postId, $topLevel, $childrenByParent, $perPage)
    {
        $byId = [];
        foreach ($childrenByParent as $children) {
            foreach ($children as $child) {
                $byId[(int) $child->comment_ID] = $child;
            }
        }

        // Climb to the root of the thread. Bounded by the number of comments
        // seen so a parent cycle — which the database should never hold, but
        // which would hang the request if it did — cannot loop forever.
        $rootId = $commentId;
        $guard = \count($byId) + 1;
        while (isset($byId[$rootId]) && $guard-- > 0) {
            $comment = $byId[$rootId];

            if ((int) $comment->comment_post_ID !== $postId) {
                return 0;
            }

            $rootId = (int) $comment->comment_parent;
        }

        foreach (array_values($topLevel) as $index => $comment) {
            if ((int) $comment->comment_ID === $rootId) {
                return (int) (floor($index / $perPage) + 1);
            }
        }

        return 0;
    }

    private function getVotesTable()
    {
        return Config::withDBPrefix('votes');
    }

    private function formatComment($comment, $votesTable, $currentUserId)
    {
        $authorId = (int) $comment->user_id;
        $authorBadge = UserBadgeService::for($authorId);
        $isHidden = ContentVisibilityService::isCommentHidden($comment);
        $keepsWords = ContentVisibilityService::canViewHidden()
            || ContentVisibilityService::isOwnContent($authorId);

        $voteCount = Vote::getCommentVoteCount($comment->comment_ID);

        $hasVoted = false;
        if ($currentUserId) {
            $userVote = Vote::hasUserVotedComment($currentUserId, $comment->comment_ID);
            $hasVoted = !empty($userVote);
        }

        $attachments = TopicService::formatCommentAttachments($comment->comment_ID);

        return [
            'id'          => (int) $comment->comment_ID,
            'post'        => (int) $comment->comment_post_ID,
            'parent'      => (int) $comment->comment_parent,
            'author'      => (int) $comment->user_id,
            'author_name' => $comment->comment_author,
            // Empty for guest comments (user_id 0), which have no profile.
            'author_slug' => ProfileSlugService::slugFor((int) $comment->user_id),
            'author_url'  => $comment->comment_author_url,
            'date'        => $comment->comment_date,
            'date_gmt'    => $comment->comment_date_gmt,
            'content'     => [
                // A moderator reads the words to judge them, and so does whoever
                // wrote them; everyone else gets the marker, so the thread still
                // makes sense underneath.
                'rendered' => $isHidden && !$keepsWords
                    ? ContentVisibilityService::tombstone()
                    : Hooks::applyFilter('comment_text', $comment->comment_content),
            ],
            'link'               => get_comment_link($comment),
            'status'             => $comment->comment_approved,
            'type'               => $comment->comment_type,
            'author_avatar_urls' => [
                '24' => get_avatar_url($comment, ['size' => 24]),
                '48' => get_avatar_url($comment, ['size' => 48]),
                '96' => get_avatar_url($comment, ['size' => 96]),
            ],
            'votes'       => (int) $voteCount,
            'hasVoted'    => $hasVoted,
            'attachments' => $attachments,
            // The author's standing, or null for an ordinary member.
            'author_badge' => $authorBadge,
            // "Out of public view", not "you may read this". True on a tombstone
            // too, which is what stops the portal offering to report a reply
            // whose words the reader cannot see. Whether to show a badge as well
            // is the client's call, and it makes it from who is reading.
            'hidden' => $isHidden,
            // Who last edited this and when, or null if nobody has. `by_author`
            // separates the plain "(edited)" from a colleague's byline.
            'edited' => EditAttributionService::forComment((int) $comment->comment_ID),
            // Superseded by author_badge; kept until the portal stops reading it,
            // because post-commons.ts defaults a missing value to false and would
            // silently un-badge every staff comment. Note this now answers true
            // for a forum_moderate-only member, where the old
            // hasModeratorRole() check (manage_options || forum_manage) said no.
            'isAdmin' => $authorBadge !== null,
        ];
    }
}
