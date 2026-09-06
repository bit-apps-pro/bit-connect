<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Enum\Capabilities;
use BitApps\BitConnect\Services\PermissionService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;

class PermissionServiceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_caps']            = [];
        $GLOBALS['__wp_current_user_id'] = 0;
        $GLOBALS['__wp_posts']           = [];
        $GLOBALS['__wp_comments']        = [];
    }

    private function grant(string ...$caps): void
    {
        foreach ($caps as $cap) {
            $GLOBALS['__wp_caps'][$cap] = true;
        }
    }

    private function makePost(int $author): WP_Post
    {
        $post              = new WP_Post();
        $post->post_author = $author;

        return $post;
    }

    private function makeComment(int $userId): WP_Comment
    {
        $comment          = new WP_Comment();
        $comment->user_id = $userId;

        return $comment;
    }

    public function testCanCreatePostReflectsCapability(): void
    {
        $this->assertFalse(PermissionService::canCreatePost());

        $this->grant(Capabilities::CREATE_POST->value);
        $this->assertTrue(PermissionService::canCreatePost());
    }

    /**
     * Nothing edits somebody else's topic — not the report queue, not removal,
     * not administration. Every capability the forum grants is handed to one
     * user here at once, and the answer is still no.
     *
     * This replaces a test that asserted the opposite. It had been failing on
     * its own since forum_edit_any was split out of forum_moderate, because it
     * granted the moderation flag and expected the editing one.
     */
    public function testNoCapabilityLetsAnyoneEditSomebodyElsesPost(): void
    {
        $this->grant(...array_map(
            static fn (Capabilities $cap): string => $cap->value,
            Capabilities::cases()
        ));

        $GLOBALS['__wp_current_user_id'] = 999; // not the author
        $GLOBALS['__wp_posts'][7]        = $this->makePost(1);

        $this->assertFalse(PermissionService::canEditPost(7));
    }

    /**
     * The same, for comments, and beside the removal it is contrasted with:
     * forum_delete_any takes a reply down, and nothing rewrites one.
     */
    public function testModeratorMayDeleteAnothersCommentButNotEditIt(): void
    {
        $this->grant(Capabilities::MODERATE->value, Capabilities::DELETE_ANY->value);
        $GLOBALS['__wp_current_user_id'] = 999;
        $GLOBALS['__wp_comments'][3]     = $this->makeComment(1);

        $this->assertTrue(PermissionService::canDeleteComment(3));
        $this->assertFalse(PermissionService::canEditComment(3));
    }

    /**
     * The author keeps editing whatever the topic's status has become.
     *
     * canEditPost() never reads the status, and that is the point: the window
     * that used to close here existed alongside a moderator who could still
     * correct the topic afterwards, and without one it would leave answered
     * topics that nobody on the site could fix.
     */
    public function testAuthorKeepsEditingRegardlessOfStatus(): void
    {
        $this->grant(Capabilities::EDIT_OWN_POST->value);
        $GLOBALS['__wp_current_user_id'] = 5;
        $GLOBALS['__wp_posts'][7]        = $this->makePost(5);

        $this->assertTrue(PermissionService::canEditPost(7));
    }

    public function testOwnerCanEditOwnPostWithCapability(): void
    {
        $this->grant(Capabilities::EDIT_OWN_POST->value);
        $GLOBALS['__wp_current_user_id'] = 5;
        $GLOBALS['__wp_posts'][7]        = $this->makePost(5);

        $this->assertTrue(PermissionService::canEditPost(7));
    }

    public function testNonOwnerCannotEditPost(): void
    {
        $this->grant(Capabilities::EDIT_OWN_POST->value);
        $GLOBALS['__wp_current_user_id'] = 5;
        $GLOBALS['__wp_posts'][7]        = $this->makePost(99); // owned by someone else

        $this->assertFalse(PermissionService::canEditPost(7));
    }

    public function testEditPostWithoutEditOwnCapabilityIsDenied(): void
    {
        $GLOBALS['__wp_current_user_id'] = 5;
        $GLOBALS['__wp_posts'][7]        = $this->makePost(5); // owns it, but lacks the cap

        $this->assertFalse(PermissionService::canEditPost(7));
    }

    public function testDeleteCommentOwnershipBranch(): void
    {
        $this->grant(Capabilities::DELETE_OWN_COMMENT->value);
        $GLOBALS['__wp_current_user_id'] = 8;
        $GLOBALS['__wp_comments'][3]     = $this->makeComment(8);

        $this->assertTrue(PermissionService::canDeleteComment(3));

        $GLOBALS['__wp_comments'][3] = $this->makeComment(100);
        $this->assertFalse(PermissionService::canDeleteComment(3));
    }

    public function testOwnershipHelperReturnsFalseForMissingPost(): void
    {
        $GLOBALS['__wp_current_user_id'] = 5;

        $this->assertFalse(PermissionService::currentUserOwnsPost(404));
    }

    public function testIsForumParticipantWhenAnyMemberCapGranted(): void
    {
        $this->assertFalse(PermissionService::isForumParticipant());

        $this->grant(Capabilities::VOTE_POST->value);
        $this->assertTrue(PermissionService::isForumParticipant());
    }

    public function testCurrentUserCapabilitiesAnswersEveryCapability(): void
    {
        $capabilities = PermissionService::currentUserCapabilities();

        // Every slug is present, so the portal never has to tell "not sent"
        // apart from "not allowed".
        foreach (Capabilities::cases() as $capability) {
            $this->assertArrayHasKey($capability->value, $capabilities);
            $this->assertFalse($capabilities[$capability->value]);
        }
    }

    public function testCurrentUserCapabilitiesReportsOnlyWhatIsGranted(): void
    {
        $this->grant(Capabilities::MODERATE->value, Capabilities::VOTE_POST->value);

        $capabilities = PermissionService::currentUserCapabilities();

        $this->assertTrue($capabilities[Capabilities::MODERATE->value]);
        $this->assertTrue($capabilities[Capabilities::VOTE_POST->value]);
        $this->assertFalse($capabilities[Capabilities::MANAGE->value]);
        $this->assertFalse($capabilities[Capabilities::CREATE_POST->value]);
    }
}
