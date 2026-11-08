<?php

namespace BitApps\BitConnect\Services;

// Prevent direct script access
if (!defined('ABSPATH')) {
    exit;
}

use BitApps\BitConnect\Deps\BitApps\WPKit\Utils\Capabilities as WpCapabilities;
use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Enum\NotificationTypes;
use BitApps\BitConnect\Enum\PostTypes;
use BitApps\BitConnect\Model\Follow;
use BitApps\BitConnect\Services\Events\Events;
use InvalidArgumentException;
use WP_Comment;
use WP_Post;

/**
 * Writes a comment the way the portal does: every check the comment endpoint
 * made, the write, its files, and the people who should hear about it.
 *
 * The controller used to do all of this itself. It lives here so that every
 * route that comments on a member's behalf — the portal's own, and any an
 * integration adds — meets the same rules and tells the same people.
 *
 * Acts as the current user. A caller acting for someone else switches the
 * current user first.
 */
final class CommentService
{
    private const MAX_DEPTH = 5;

    /**
     * @param int   $postId      the topic to comment on
     * @param mixed $content     the comment's words, before sanitizing
     * @param int   $parentId    the comment this one answers, or 0
     * @param int[] $attachments uploaded file ids
     *
     * @throws CommentRejected when a rule refuses the comment, with the status
     *                         the comment endpoint has always answered with
     */
    public function create(int $postId, $content, int $parentId = 0, array $attachments = []): WP_Comment
    {
        $post = get_post($postId);

        // Only forum topics accept comments — without this, anyone with the
        // create-comment cap could attach comments to any page/post on the site.
        // And only topics the commenter may read: a topic they cannot open is
        // answered as missing, the way reading its comments already is.
        if (!$post || $post->post_type !== PostTypes::BIT_CONNECT->value || !TopicService::isReadable($post)) {
            throw new CommentRejected('Post not found', 404);
        }

        if (!TopicAccess::allows(TopicAccess::COMMENT)) {
            throw new CommentRejected(__('Comments are turned off in this forum.', 'bit-connect'), 403);
        }

        // Respect topic lock (comment_status closed). Moderators bypass the lock.
        if ($post->comment_status !== 'open' && !WpCapabilities::check(Capabilities::MODERATE->value)) {
            throw new CommentRejected('This post is locked.', 403);
        }

        $sanitizer = new CommentSanitizerService();

        try {
            $content = $sanitizer->sanitize($content);
        } catch (InvalidArgumentException $e) {
            throw new CommentRejected($e->getMessage(), 422);
        }

        $attachments = array_map('intval', $attachments);

        if (!self::hasSubstance($content, $attachments)) {
            throw new CommentRejected(__('Comment content is required.', 'bit-connect'), 422);
        }

        try {
            PostingLimits::assertWithin('comment', $content, $attachments);
        } catch (InvalidArgumentException $e) {
            throw new CommentRejected($e->getMessage(), 422);
        }

        if ($parentId > 0) {
            $parentComment = get_comment($parentId);
            if (!$parentComment || $parentComment->comment_post_ID != $postId) {
                throw new CommentRejected('Invalid parent comment', 400);
            }

            $depth = 1;
            $currentParent = $parentComment;
            while ($currentParent->comment_parent > 0 && $depth < self::MAX_DEPTH) {
                $currentParent = get_comment($currentParent->comment_parent);
                ++$depth;
            }

            if ($depth >= self::MAX_DEPTH) {
                throw new CommentRejected('Maximum comment nesting depth reached', 400);
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
            throw new CommentRejected('Failed to create comment.', 500);
        }

        if (!empty($attachments)) {
            update_comment_meta($commentId, '_bit_connect_comment_attachments', $attachments);
        }

        // The files attached to the reply and the pictures placed in it are in
        // use now, so the cleanup of unused uploads leaves them alone.
        UploadClaims::claim(array_merge($attachments, UploadClaims::idsInContent($content)));

        $comment = get_comment($commentId);
        if (!$comment) {
            throw new CommentRejected('Comment created but could not be retrieved', 500);
        }

        // After the write, never instead of it. A notification that could not be
        // sent is not a reason to tell the member their comment failed — the
        // comment is on the page either way, and the whole system is best-effort
        // by design.
        $this->notifyThread($post, $comment, $parentId);

        Events::commentCreated($comment, $post);

        return $comment;
    }

    /**
     * Whether a comment says or shows anything once sanitized. The request's
     * `required` rule passes `<p></p>` and a run of spaces, which sanitize to
     * nothing. A picture or video on its own counts, as it does in the editor,
     * and so does a comment that only carries files.
     *
     * @param int[] $attachmentIds
     */
    public static function hasSubstance(string $content, array $attachmentIds): bool
    {
        if ($attachmentIds !== [] || preg_match('~<(?:img|video|iframe)\b~i', $content)) {
            return true;
        }

        $text = html_entity_decode(wp_strip_all_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim(str_replace("\u{00A0}", ' ', $text)) !== '';
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
}
