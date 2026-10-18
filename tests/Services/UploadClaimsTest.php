<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\UploadClaims;
use PHPUnit\Framework\TestCase;

/**
 * Pins down which uploads count as used, so the daily cleanup of unused ones
 * can never take a file a post shows.
 *
 * @internal
 *
 * @coversNothing
 */
final class UploadClaimsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['__wp_post_meta'] = [];
        $GLOBALS['__wp_attachment_urls'] = [
            'https://forum.example/wp-content/uploads/a.png'   => 11,
            'https://forum.example/wp-content/uploads/b.mp4'   => 12,
            'https://forum.example/wp-content/uploads/c&d.png' => 13,
        ];
    }

    protected function tearDown(): void
    {
        unset($GLOBALS['__wp_attachment_urls']);
        $GLOBALS['__wp_post_meta'] = [];
    }

    public function testThePicturesAndVideosInATextAreItsUploads(): void
    {
        $html = '<p>See <img src="https://forum.example/wp-content/uploads/a.png" alt=""></p>'
            . '<figure class="wp-block-video"><video src="https://forum.example/wp-content/uploads/b.mp4" controls></video></figure>'
            . '<p><img src="https://forum.example/wp-content/uploads/a.png"></p>';

        $this->assertSame([11, 12], UploadClaims::idsInContent($html));
    }

    public function testAnAddressThatIsNotAnUploadIsIgnored(): void
    {
        $html = '<img src="https://elsewhere.example/x.png"><a href="https://forum.example/wp-content/uploads/a.png">a</a>';

        $this->assertSame([], UploadClaims::idsInContent($html));
    }

    public function testAnEscapedAddressIsReadAsWritten(): void
    {
        $this->assertSame([13], UploadClaims::idsInContent('<img src="https://forum.example/wp-content/uploads/c&amp;d.png">'));
    }

    public function testAnUploadWaitsForItsPostAndIsClaimedByIt(): void
    {
        UploadClaims::recordUpload(11);

        $this->assertNotSame('', get_post_meta(11, UploadClaims::PENDING_META, true));

        UploadClaims::claim([11]);

        $this->assertSame('', get_post_meta(11, UploadClaims::PENDING_META, true));
    }

    public function testOnlyThePortalsOwnUploadsAreHandedBackToTheCleanup(): void
    {
        UploadClaims::recordUpload(11);
        UploadClaims::claim([11]);

        // 12 was put in the media library by an administrator, not the portal.
        UploadClaims::release([11, 12]);

        $this->assertNotSame('', get_post_meta(11, UploadClaims::PENDING_META, true));
        $this->assertSame('', get_post_meta(12, UploadClaims::PENDING_META, true));
    }
}
