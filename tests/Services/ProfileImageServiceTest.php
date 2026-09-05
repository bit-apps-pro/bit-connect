<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\AvatarService;
use BitApps\BitConnect\Services\CoverImageService;
use PHPUnit\Framework\TestCase;
use WP_Comment;
use WP_Post;
use WP_User;

/**
 * Pins down the two images a member owns: their picture and their cover.
 *
 * Both are one attachment id in user meta, and both fail the same two ways.
 * A replaced image whose predecessor is not deleted leaves a file behind in the
 * media library on every change — invisible until someone opens it. And an
 * attachment deleted from wp-admin leaves a reference pointing at nothing, so
 * the reference is dropped on read and the member falls back cleanly rather
 * than rendering a broken image forever.
 *
 * @internal
 *
 * @coversNothing
 */
final class ProfileImageServiceTest extends TestCase
{
    private const MEMBER = 3;

    protected function tearDown(): void
    {
        $GLOBALS['__wp_user_meta'] = [];
        $GLOBALS['__wp_users'] = [];
        $GLOBALS['__wp_attachments'] = [];
        $GLOBALS['__wp_deleted_attachments'] = [];
        $GLOBALS['__wp_filter_callbacks'] = [];
    }

    // -----------------------------------------------------------------------
    // Avatars — having one, or not
    // -----------------------------------------------------------------------

    public function testAMemberWhoUploadedNothingHasNoPicture(): void
    {
        $this->assertSame(0, AvatarService::avatarId(self::MEMBER));
        $this->assertNull(AvatarService::avatarUrl(self::MEMBER));
    }

    public function testAnUploadedPictureIsServedBack(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face-150.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame(12, AvatarService::avatarId(self::MEMBER));
        $this->assertSame('https://example.com/face-150.jpg', AvatarService::avatarUrl(self::MEMBER));
    }

    /**
     * An avatar rendered at 24px should not download a two-thousand-pixel
     * upload, so a generated size is served rather than the original.
     */
    public function testASmallAvatarIsServedFromTheThumbnail(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face-150.jpg', 'medium' => 'https://example.com/face-300.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame('https://example.com/face-150.jpg', AvatarService::avatarUrl(self::MEMBER, 24));
        $this->assertSame('https://example.com/face-150.jpg', AvatarService::avatarUrl(self::MEMBER, 150));
    }

    public function testALargerAvatarIsServedFromTheMediumSize(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face-150.jpg', 'medium' => 'https://example.com/face-300.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame('https://example.com/face-300.jpg', AvatarService::avatarUrl(self::MEMBER, 151));
    }

    // -----------------------------------------------------------------------
    // Avatars — replacing and removing
    // -----------------------------------------------------------------------

    public function testReplacingAPictureDeletesTheFileBehindTheOldOne(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/old.jpg']);
        $this->seedAttachment(13, ['thumbnail' => 'https://example.com/new.jpg']);

        AvatarService::setAvatar(self::MEMBER, 12);
        AvatarService::setAvatar(self::MEMBER, 13);

        $this->assertSame(13, AvatarService::avatarId(self::MEMBER));
        $this->assertSame([['id' => 12, 'force' => true]], $GLOBALS['__wp_deleted_attachments']);
    }

    public function testSettingTheSamePictureAgainDoesNotDeleteIt(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);

        AvatarService::setAvatar(self::MEMBER, 12);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame([], $GLOBALS['__wp_deleted_attachments']);
        $this->assertSame('https://example.com/face.jpg', AvatarService::avatarUrl(self::MEMBER));
    }

    public function testAFirstUploadDeletesNothing(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);

        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame([], $GLOBALS['__wp_deleted_attachments']);
    }

    public function testRemovingAPictureTakesTheFileWithIt(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertTrue(AvatarService::removeAvatar(self::MEMBER));

        $this->assertSame(0, AvatarService::avatarId(self::MEMBER));
        $this->assertSame([['id' => 12, 'force' => true]], $GLOBALS['__wp_deleted_attachments']);
    }

    public function testRemovingAPictureNobodyUploadedReportsThereWasNothingToRemove(): void
    {
        $this->assertFalse(AvatarService::removeAvatar(self::MEMBER));
        $this->assertSame([], $GLOBALS['__wp_deleted_attachments']);
    }

    /**
     * Deleting the attachment from wp-admin leaves the reference pointing at
     * nothing. It is dropped on read so the member falls back to Gravatar
     * rather than rendering a broken image on every page they appear on.
     */
    public function testAReferenceToADeletedFileIsDroppedOnRead(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        unset($GLOBALS['__wp_attachments'][12]);

        $this->assertNull(AvatarService::avatarUrl(self::MEMBER));
        $this->assertSame(0, AvatarService::avatarId(self::MEMBER));
    }

    // -----------------------------------------------------------------------
    // Standing in for Gravatar
    // -----------------------------------------------------------------------

    /**
     * Filtering pre_get_avatar_data rather than get_avatar_url covers both, so
     * a theme calling get_avatar() does not still show Gravatar.
     */
    public function testTheAvatarFilterIsRegisteredWhereBothCoreCallsPassThrough(): void
    {
        AvatarService::registerHooks();

        $this->assertContains(
            [AvatarService::class, 'filterAvatarData'],
            $GLOBALS['__wp_filter_callbacks']['pre_get_avatar_data']
        );
    }

    public function testTheFilterPointsWordPressAtTheUploadedPicture(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $filtered = AvatarService::filterAvatarData(['size' => 96], self::MEMBER);

        $this->assertSame('https://example.com/face.jpg', $filtered['url']);
    }

    /**
     * Without this core can still rebuild a Gravatar URL further down the
     * filter chain.
     */
    public function testTheFilterMarksTheUrlAsFinal(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertTrue(AvatarService::filterAvatarData(['size' => 96], self::MEMBER)['found_avatar']);
    }

    public function testTheFilterLeavesGravatarAloneForAMemberWithNoPicture(): void
    {
        $args = ['size' => 96, 'url' => 'https://gravatar.example/hash'];

        $this->assertSame($args, AvatarService::filterAvatarData($args, self::MEMBER));
    }

    public function testTheRequestedSizeDecidesWhichGeneratedImageTheFilterServes(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/small.jpg', 'medium' => 'https://example.com/big.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);

        $this->assertSame('https://example.com/big.jpg', AvatarService::filterAvatarData(['size' => 300], self::MEMBER)['url']);
    }

    public function testTheFilterResolvesAMemberFromEveryIdentifierCorePassesIt(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        AvatarService::setAvatar(self::MEMBER, 12);
        $this->seedUser(self::MEMBER, 'member@example.com');

        $post = new WP_Post();
        $post->post_author = self::MEMBER;

        $comment = new WP_Comment();
        $comment->user_id = self::MEMBER;

        $user = $GLOBALS['__wp_users'][self::MEMBER];

        foreach ([self::MEMBER, '3', $user, $post, $comment, 'member@example.com'] as $identifier) {
            $this->assertSame(
                'https://example.com/face.jpg',
                AvatarService::filterAvatarData(['size' => 96], $identifier)['url'],
                'should have resolved ' . get_debug_type($identifier)
            );
        }
    }

    /**
     * Guest comments carry no user id and only ever get a Gravatar.
     */
    public function testAGuestCommenterIsLeftToGravatar(): void
    {
        $comment = new WP_Comment();
        $comment->user_id = 0;

        $args = ['size' => 96];

        $this->assertSame($args, AvatarService::filterAvatarData($args, $comment));
    }

    public function testAnEmailBelongingToNobodyIsLeftToGravatar(): void
    {
        $args = ['size' => 96];

        $this->assertSame($args, AvatarService::filterAvatarData($args, 'stranger@example.com'));
        $this->assertSame($args, AvatarService::filterAvatarData($args, 'not-an-email'));
    }

    // -----------------------------------------------------------------------
    // Covers
    // -----------------------------------------------------------------------

    public function testAMemberWhoUploadedNothingHasNoCover(): void
    {
        $this->assertSame(0, CoverImageService::coverId(self::MEMBER));
        $this->assertNull(CoverImageService::coverUrl(self::MEMBER));
    }

    /**
     * A cover spans the full width of the card, so `large` — but still not the
     * original, which may be several thousand pixels wide.
     */
    public function testACoverIsServedFromTheLargeSize(): void
    {
        $this->seedAttachment(20, ['large' => 'https://example.com/cover-1024.jpg', 'thumbnail' => 'https://example.com/cover-150.jpg']);
        CoverImageService::setCover(self::MEMBER, 20);

        $this->assertSame('https://example.com/cover-1024.jpg', CoverImageService::coverUrl(self::MEMBER));
    }

    public function testReplacingACoverDeletesTheFileBehindTheOldOne(): void
    {
        $this->seedAttachment(20, ['large' => 'https://example.com/old.jpg']);
        $this->seedAttachment(21, ['large' => 'https://example.com/new.jpg']);

        CoverImageService::setCover(self::MEMBER, 20);
        CoverImageService::setCover(self::MEMBER, 21);

        $this->assertSame(21, CoverImageService::coverId(self::MEMBER));
        $this->assertSame([['id' => 20, 'force' => true]], $GLOBALS['__wp_deleted_attachments']);
    }

    public function testRemovingACoverTakesTheFileWithIt(): void
    {
        $this->seedAttachment(20, ['large' => 'https://example.com/cover.jpg']);
        CoverImageService::setCover(self::MEMBER, 20);

        $this->assertTrue(CoverImageService::removeCover(self::MEMBER));
        $this->assertSame(0, CoverImageService::coverId(self::MEMBER));
    }

    public function testRemovingACoverNobodyUploadedReportsThereWasNothingToRemove(): void
    {
        $this->assertFalse(CoverImageService::removeCover(self::MEMBER));
    }

    public function testACoverReferenceToADeletedFileIsDroppedOnRead(): void
    {
        $this->seedAttachment(20, ['large' => 'https://example.com/cover.jpg']);
        CoverImageService::setCover(self::MEMBER, 20);

        unset($GLOBALS['__wp_attachments'][20]);

        $this->assertNull(CoverImageService::coverUrl(self::MEMBER));
        $this->assertSame(0, CoverImageService::coverId(self::MEMBER));
    }

    /**
     * The two images are separate meta keys; setting one must not disturb the
     * other.
     */
    public function testAPictureAndACoverAreKeptApart(): void
    {
        $this->seedAttachment(12, ['thumbnail' => 'https://example.com/face.jpg']);
        $this->seedAttachment(20, ['large' => 'https://example.com/cover.jpg']);

        AvatarService::setAvatar(self::MEMBER, 12);
        CoverImageService::setCover(self::MEMBER, 20);

        AvatarService::removeAvatar(self::MEMBER);

        $this->assertSame(20, CoverImageService::coverId(self::MEMBER));
        $this->assertSame('https://example.com/cover.jpg', CoverImageService::coverUrl(self::MEMBER));
    }

    /**
     * A PDF is a valid attachment but not a valid face, so this list is
     * narrower than the attachment validator's.
     */
    public function testOnlyImagesMayBeAPictureOrACover(): void
    {
        $this->assertSame(['image/jpeg', 'image/png', 'image/gif', 'image/webp'], AvatarService::ALLOWED_MIMES);
        $this->assertSame(AvatarService::ALLOWED_MIMES, CoverImageService::ALLOWED_MIMES);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * @param array<string, string> $urlsBySize
     */
    private function seedAttachment(int $attachmentId, array $urlsBySize): void
    {
        $GLOBALS['__wp_attachments'][$attachmentId] = $urlsBySize;
    }

    private function seedUser(int $userId, string $email): void
    {
        $user = new WP_User();
        $user->ID = $userId;
        $user->user_email = $email;

        $GLOBALS['__wp_users'][$userId] = $user;
    }
}
