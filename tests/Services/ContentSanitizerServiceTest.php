<?php

namespace BitApps\BitConnect\Tests\Services;

use BitApps\BitConnect\Services\ContentSanitizerService;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 *
 * @coversNothing
 */
class ContentSanitizerServiceTest extends TestCase
{
    public function testAllowedHtmlWhitelistsExpectedTags(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        // Core Quill formatting tags are present.
        foreach (['p', 'strong', 'em', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'code'] as $tag) {
            $this->assertArrayHasKey($tag, $allowed, "expected <{$tag}> to be allowed");
        }
    }

    public function testAllowedHtmlExcludesDangerousTags(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        foreach (['script', 'iframe', 'object', 'embed', 'style', 'form'] as $tag) {
            $this->assertArrayNotHasKey($tag, $allowed, "did not expect <{$tag}> to be allowed");
        }
    }

    public function testLinkTagAllowsHrefButControlsAttributes(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('href', $allowed['a']);
        $this->assertArrayHasKey('rel', $allowed['a']);
        $this->assertArrayHasKey('target', $allowed['a']);
        // onclick and other event handlers must not be whitelisted.
        $this->assertArrayNotHasKey('onclick', $allowed['a']);
    }

    public function testImageTagAllowsSrcButNotEvents(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('src', $allowed['img']);
        $this->assertArrayNotHasKey('onerror', $allowed['img']);
    }

    public function testVideoTagAllowsItsFileAndControlsButNeverAutoplay(): void
    {
        $allowed = (new ContentSanitizerService())->getAllowedHtml();

        $this->assertArrayHasKey('src', $allowed['video']);
        $this->assertArrayHasKey('controls', $allowed['video']);
        $this->assertArrayNotHasKey('autoplay', $allowed['video']);
        $this->assertArrayNotHasKey('onerror', $allowed['video']);
    }

    public function testAVideoFromTheSitesOwnUploadsIsKept(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://forum.example';
        unset($GLOBALS['__wp_upload_baseurl']);

        $html = '<p>Watch</p><video src="https://forum.example/wp-content/uploads/clip.mp4" controls></video>';

        $this->assertStringContainsString(
            '<figure class="wp-block-video"><video src="https://forum.example/wp-content/uploads/clip.mp4" controls></video></figure>',
            (new ContentSanitizerService())->sanitize($html)
        );
    }

    public function testAVideoFromOffloadedUploadsIsKeptToo(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://forum.example';
        $GLOBALS['__wp_upload_baseurl'] = 'https://cdn.example/media';

        $html = '<video src="https://cdn.example/media/clip.mp4" controls></video>';

        $this->assertStringContainsString('cdn.example/media/clip.mp4', (new ContentSanitizerService())->sanitize($html));
    }

    public function testAVideoFromAnotherHostIsDropped(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://forum.example';
        unset($GLOBALS['__wp_upload_baseurl']);

        $html = '<p>Watch</p><video src="https://tracker.example/clip.mp4" controls></video><p>After</p>';

        $this->assertSame('<p>Watch</p><p>After</p>', (new ContentSanitizerService())->sanitize($html));
    }

    public function testAVideoWithoutAFileIsDropped(): void
    {
        $GLOBALS['__wp_home_url'] = 'https://forum.example';

        $this->assertSame('<p>Watch</p>', (new ContentSanitizerService())->sanitize('<p>Watch</p><video controls></video>'));
    }
}
